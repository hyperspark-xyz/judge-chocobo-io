import express, { Request, Response, NextFunction } from "express";
import { Express } from "express";
import { migrations } from './migrations';
import { runMigrations } from "lauf";
import pg from "pg";
import cors from "cors";
import * as ws from "ws";
import { IncomingMessage, Server, ServerResponse } from "http";
import { parse } from "url";

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

interface JudgeWebSocket {
    judgeName?: string;
    socket: ws.WebSocket;
}

const clientsBySession = new Map<string, Array<JudgeWebSocket>>();

const broadcastToSession = (sessionId: string, message: any) => {
    const clients = clientsBySession.get(sessionId);

    if (clients) {
        console.log(`Broadcasting to session ${sessionId}, ${clients.length} clients`);

        const messageString = JSON.stringify(message);
        for (const client of clients) {
            const socket = client.socket;
            if (socket.readyState === ws.WebSocket.OPEN) {
                socket.send(messageString);
            }
        }
    }
};

const tellHost = (sessionId: string, message: any) => {
    const clients = clientsBySession.get(sessionId);

    if (clients) {
        console.log(`Telling host in session ${sessionId}`);

        const messageString = JSON.stringify(message);
        for (const client of clients) {
            if (client.judgeName === 'host') {
                const socket = client.socket;
                if (socket.readyState === ws.WebSocket.OPEN) {
                    socket.send(messageString);
                }
            }
        }
    }
};

const createDatabaseConnection = async () => {
    const pgClient = new pg.Client({ 
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME,
    });

    await pgClient.connect();
    return pgClient;
}

const applyMigrations = () => {
    return runMigrations({
        setup: async() => {
            const pgClient = await createDatabaseConnection();
            return {pgClient}
        },
        teardown: ({pgClient}) => pgClient.end(),
        migrations,
    })
}

const startServer = (client: pg.Client): [Express, Server<typeof IncomingMessage, typeof ServerResponse>] => {
    const PORT = Number(process.env.PORT ?? 3000);
    const app = express();

    app.use(express.json());
    app.use(cors())

    // Simple routes
    app.get("/healthz", (_req: Request, res: Response) => {
        res.status(200).json({ status: "ok" });
    });

    app.get("/session/:sessionId", async (req: Request, res: Response) => {
        const sessionId = req.params.sessionId;
        const result = await client.query(
            `SELECT id, created_at, name, ended_at FROM sessions WHERE id = $1`,
            [sessionId],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Session not found" });
        }

        const session = result.rows[0];
        res.status(200).json({
            session: { 
                id: session.id,
                createdAt: session.created_at,
                name: session.name,
                endedAt: session.ended_at, 
            }
        });
    });

    app.post("/session", async (_req: Request, res: Response) => {
        const result = await client.query(
            `INSERT INTO sessions (name) VALUES ($1) RETURNING id`,
            ['Untitled Session'],
        );

        const sessionId = result.rows[0].id;
        res.status(201).json({ sessionId });
    });

    app.get("/session/:sessionId/entrants", async (req: Request, res: Response) => {
        const sessionId = req.params.sessionId;
        const result = await client.query(
            `SELECT name FROM entrants WHERE session_id = $1`,
            [sessionId],
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Session not found" });
        }

        const entrants = result.rows.map((row) => row.name) || [];
        res.status(200).json({ entrants });
    });

    app.post("/session/:sessionId/entrants", async (req: Request, res: Response) => {
        const sessionId = req.params.sessionId;
        const entrants: string[] = req.body.entrants;

        const currentEntrantsResult = await client.query(
            `SELECT id, name FROM entrants WHERE session_id = $1`,
            [sessionId],
        );

        const currentEntrants = currentEntrantsResult.rows.map((row) => ({ id: row.id, name: row.name }));

        // Delete entrants that are no longer present
        const toDeleteEntrants = currentEntrants.filter((e) => !entrants.includes(e.name));

        if (toDeleteEntrants.length > 0) {
            const toDeleteIds = toDeleteEntrants.map((e) => e.id);
            const toDeleteNames = toDeleteEntrants.map((e) => e.name);

            await client.query(
                `DELETE FROM entrants WHERE id = ANY($1::uuid[])`,
                [toDeleteIds],
            );

            // Notify judges about removed entrants
            for (const entrantName of toDeleteNames) {
                broadcastToSession(sessionId, {
                    type: 'entrantRemoved',
                    entrant: entrantName,
                });
            }
        }

        // Add new entrants
        const toAddNames = entrants.filter((name) => !currentEntrants.some((e) => e.name === name));

        if (toAddNames.length > 0) {
            await client.query(
                `INSERT INTO entrants (session_id, name) SELECT $1, unnest($2::text[])`,
                [sessionId, toAddNames],
            );

            // Notify judges about new entrants
            for (const entrantName of toAddNames) {
                broadcastToSession(sessionId, {
                    type: 'entrantAdded',
                    entrant: entrantName,
                });
            }
        }
        
        res.status(200).json({ message: "Entrants updated" });
    });

    app.post("/session/:sessionId/judge", async (req: Request, res: Response) => {
        const sessionId = req.params.sessionId;
        const judgeName: string = req.body.name;

        const result = await client.query(
            `INSERT INTO judges (session_id, name) VALUES ($1, $2) RETURNING id`,
            [sessionId, judgeName],
        );

        const judgeId = result.rows[0].id;
        res.status(201).json({ judgeId });
    });

    app.post("/session/:sessionId/score", async (req: Request, res: Response) => {
        const sessionId = req.params.sessionId;
        const { judgeName, scores } : { judgeName: string; scores: { [entrant: string]: number } } = req.body;

        const entrants = Object.entries(scores);
        
        // Validate entrants
        const entrantResult = await client.query(
            `SELECT id, name FROM entrants WHERE session_id = $1 AND name = ANY($2::text[])`,
            [sessionId, entrants],
        );

        if (entrantResult.rows.length === 0) {
            return res.status(400).json({ error: "Bad input" });
        }

        const judgeResult = await client.query(
            `SELECT id FROM judges WHERE session_id = $1 AND name = $2`,
            [sessionId, judgeName],
        );

        if (judgeResult.rows.length === 0) {
            return res.status(400).json({ error: "Bad input" });
        }

        const entrantsWithId = entrantResult.rows.map((row) => ({id: row.id, name: row.name}));
        const judgeId = judgeResult.rows[0].id;

        const scoreList = [];
        const entrantIds = [];

        for (const [entrantName, score] of Object.entries(scores)) {
            const entrant = entrantsWithId.find(e => e.name === entrantName);

            scoreList.push(score);
            entrantIds.push(entrant!.id);
        }

        await client.query(
            `INSERT INTO scores (judge_id, entrant_id, score)
             SELECT $1, UNNEST($2::uuid[]) as entrant_id, UNNEST($3::int[]) as score
             ON CONFLICT (judge_id, entrant_id)
             DO UPDATE SET score = EXCLUDED.score`,
            [judgeId, entrantIds, scoreList],
        );

        tellHost(sessionId, {
            type: 'scoreUpdate',
            judgeName,
            scores,
        });

        res.status(200).json({ message: "Score recorded" });
    });

    app.get("/session/:sessionId/score", async (req: Request, res: Response) => {
        const sessionId = req.params.sessionId;
        const judgeName = req.query.judgeName as string;

        const result = await client.query(
            `SELECT e.name as entrant_name, s.score
             FROM scores s
             JOIN entrants e ON s.entrant_id = e.id
             JOIN judges j ON s.judge_id = j.id
             WHERE j.name = $1 AND j.session_id = $2`,
            [judgeName, sessionId],
        );

        const scores = result.rows.reduce((acc, row) => {
            acc[row.entrant_name] = row.score;
            return acc;
        }, {});

        res.status(200).json({ scores });
    });

    // 404
    app.use((_req: Request, res: Response) => {
        res.status(404).json({ error: "Not Found" });
    });

    // Error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        console.error(err);
        res.status(err?.status ?? 500).json({ error: err?.message ?? "Internal Server Error" });
    });

    return [app, app.listen(PORT, () => {
        /* eslint-disable no-console */
        console.log(`Server listening on http://localhost:${PORT}`);
    })];
}

createDatabaseConnection().then((client) => {
    applyMigrations().then(() => {
        const [app, server] = startServer(client);
        const wsServer = new ws.WebSocketServer({ server, path: '/ws' });

        wsServer.on('connection', (socket, req) => {
            const sessionId = parse(req.url || '', true).query['sessionId'] as string;
            const judgeName = parse(req.url || '', true).query['judgeName'] as string;

            if (!sessionId) {
                socket.close(1008, 'Missing sessionId');
                return;
            }

            if (!judgeName) {
                socket.close(1008, 'Missing judgeName');
                return;
            }

            const client = {
                judgeName,
                socket
            };

            socket.on('close', () => {
                const clients = clientsBySession.get(sessionId);
                if (clients) {
                    clients.splice(clients.indexOf(client), 1);
                    clientsBySession.set(sessionId, clients);
                }
            });

            if (!clientsBySession.has(sessionId)) {
                clientsBySession.set(sessionId, []);
            }
            
            const clients = clientsBySession.get(sessionId)!;

            if (clients.some(c => c.judgeName === judgeName)) {
                socket.close(1008, 'Judge name already connected');
                return;
            }

            clients.push(client);
        });
    });
});
