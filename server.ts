import express, { Request, Response } from 'express';
import path from 'path';

export function startSimpleServer(): Promise<void> {
  return new Promise((resolve) => {
    const app = express();
    
    // Serve static files from the out directory
    app.use(express.static(path.join(__dirname, '../out')));
    
    // Handle any requests that don't match a file by serving index.html
    app.get('/', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../out/index.html'));
    });
    
    const server = app.listen(3000, () => {
      console.log('Simple server running on http://localhost:3000');
      resolve();
    });
    
    server.on('error', (err: Error) => {
      console.error('Server error:', err);
    });
  });
}