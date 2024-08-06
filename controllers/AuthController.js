import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(request, response) {
    if (!request.headers.authorization || request.headers.authorization.indexOf('Basic ') === -1) {
      return response.status(401).json({ message: 'Missing Auth Header' });
    }
    const rawCredentials = request.headers.authorization;
    const slice = rawCredentials.slice(6);
    const stringCredentials = Buffer.from(slice, 'base64').toString();
    const [email, pwd] = stringCredentials.split(':');

    if (!email || !pwd) return response.status(401).json({ error: 'Unauthorized' });

    const credentials = { email, password: sha1(pwd) };
    const user = await dbClient.db.collection('users').findOne(credentials);

    if (!user) { return response.status(401).json({ error: 'Unauthorized' }); }

    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 86400);
    return response.status(200).json({ token });
  }

  static async getDisconnect(request, response) {
    const token = request.headers['x-token'];
    const user = await redisClient.get(`auth_${token}`);
    if (!user) { return response.status(401).json({ error: 'Unauthorized' }); }
    await redisClient.del(`auth_${token}`);
    response.status(204).end();
    return null;
  }
}

export default AuthController;