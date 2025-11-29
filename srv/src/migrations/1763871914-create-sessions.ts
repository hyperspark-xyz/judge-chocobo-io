import { Migration } from 'lauf';

const migration: Migration = {
    id: '1763871914-create-sessions',
    description: 'Create sessions table',
    up: ({pgClient}) => {
        return pgClient.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                name TEXT NOT NULL,
                ended_at TIMESTAMPTZ
            );
        `);
    },
    down: ({pgClient}) => {
        return pgClient.query(`
            DROP TABLE IF EXISTS sessions;
        `);
    },
};

export default migration