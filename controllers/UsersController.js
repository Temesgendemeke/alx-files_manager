import crypto from 'crypto';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const mongo = require('mongodb');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!password) return res.status(400).json({ error: 'Missing password' });

    const users = await dbClient.db.collection('users');

    const foundUserArray = await users.find({ email }).toArray();
    if (foundUserArray.length > 0) return res.status(400).json({ error: 'Already exist' });

    const hashedPass = crypto.createHash('SHA1').update(password).digest('hex');
    const userCreationObj = await users.insertOne({ email, password: hashedPass });
    const newUser = { id: userCreationObj.insertedId, email };
    return res.status(201).json(newUser);
  }

  static async getMe(request, response) {
    const token = request.headers['x-token'];
    const id = await redisClient.get(`auth_${token}`);
    const objectId = new mongo.ObjectID(id);
    const user = await dbClient.db.collection('users').findOne({ _id: objectId });

    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    return response.json({ id, email: user.email });
  }
}

export default UsersController;