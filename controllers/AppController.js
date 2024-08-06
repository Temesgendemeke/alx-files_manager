import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(req, res) {
    const resObj = { redis: redisClient.isAlive(), db: dbClient.isAlive() };
    return res.status(200).send(resObj);
  }

  static async getStats(req, res) {
    const resObj = { users: await dbClient.nbUsers(), files: await dbClient.nbFiles() };
    return res.status(200).send(resObj);
  }
}

export default AppController;