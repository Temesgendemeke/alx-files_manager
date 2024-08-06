import { ObjectID } from 'mongodb';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

async function getAuth(req) {
  const token = req.headers['x-token'];
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  return userId || null;
}

class FilesController {
  static async postUpload(req, res) {
    const userId = await getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, type, data } = req.body;
    let { parentId, isPublic } = req.body;
    const files = await dbClient.db.collection('files');
    let resultObj;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || ['folder', 'file', 'image'].indexOf(type) === -1) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!parentId) parentId = 0;
    else {
      const parentFileArr = await files.find({ _id: ObjectID(parentId) }).toArray();
      if (parentFileArr.length === 0) return res.status(400).json({ error: 'Parent not found' });
      const file = parentFileArr[0];
      if (file.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }
    if (!isPublic) isPublic = false;
    if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });
    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

      const fileUUID = uuidv4();
      const localFilePath = `${folderPath}/${fileUUID}`;
      const saveData = Buffer.from(data, 'base64');
      await fs.promises.writeFile(localFilePath, saveData.toString(), { flag: 'w+' });

      resultObj = await files.insertOne({
        userId: ObjectID(userId),
        name,
        type,
        isPublic,
        parentId: parentId === 0 ? parentId : ObjectID(parentId),
        localFilePath,
      });
      if (type === 'image') {
        await fs.promises.writeFile(localFilePath, saveData, { flag: 'w+', encoding: 'binary' });
      }
    } else {
      resultObj = await files.insertOne({
        userId: ObjectID(userId),
        name,
        type,
        isPublic,
        parentId: parentId === 0 ? parentId : ObjectID(parentId),
      });
    }
    return res.status(201).json({
      id: resultObj.ops[0]._id, userId, name, type, isPublic, parentId,
    });
  }

  static async getShow(req, res) {
    const userId = await getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const objId = ObjectID(id);
    const file = await dbClient.db.collection('files').find({ _id: objId }).toArray();

    if (file.type === 'folder' && userId.toString() !== file.userId.toString()) return res.status(404).json({ error: 'Not found' });
    return res.json({
      id: file[0]._id,
      userId,
      name: file[0].name,
      type: file[0].type,
      isPublic: file[0].isPublic,
      parentId: file[0].parentId,
    });
  }

  static async getIndex(req, res) {
    const userId = await getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const parentId = req.query.parentId || 0;
    const page = req.query.page || 0;
    const aggMatch = { $and: [{ parentId }] };
    let aggData = [{ $match: aggMatch }, { $skip: page * 20 }, { $limit: 20 }];
    if (parentId === 0) aggData = [{ $skip: page * 20 }, { $limit: 20 }];

    const files = await dbClient.db.collection('files').aggregate(aggData);
    const filesArr = [];
    await files.forEach((file) => {
      const fileObj = {
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      };
      filesArr.push(fileObj);
    });
    return res.send(filesArr);
  }

  static async putPublish(req, res) {
    const userId = await getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const objId = ObjectID(id);
    const file = await dbClient.db.collection('files').find({ _id: objId }).toArray();

    if (file.type === 'folder' && userId.toString() !== file.userId.toString()) return res.status(404).json({ error: 'Not found' });

    file[0].isPublic = false;

    return res.status(200).json({
      id: file[0]._id,
      userId,
      name: file[0].name,
      type: file[0].type,
      isPublic: file[0].isPublic,
      parentId: file[0].parentId,
    });
  }

  static async putUnpublish(req, res) {
    const userId = await getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const objId = ObjectID(id);
    const file = await dbClient.db.collection('files').find({ _id: objId }).toArray();

    if (file.type === 'folder' && userId.toString() !== file.userId.toString()) return res.status(404).json({ error: 'Not found' });

    file[0].isPublic = true;

    return res.status(200).json({
      id: file[0]._id,
      userId,
      name: file[0].name,
      type: file[0].type,
      isPublic: file[0].isPublic,
      parentId: file[0].parentId,
    });
  }
}

export default FilesController;