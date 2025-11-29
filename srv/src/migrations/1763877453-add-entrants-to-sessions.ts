import { Migration } from 'lauf';

const migration: Migration = {
    id: '1763877453-add-entrants-to-sessions',
    description: 'Add entrants column to sessions table',
    up: ({pgClient}) => {
        return pgClient.query(`
            ALTER TABLE sessions
            ADD COLUMN entrants TEXT[];
        `);
    },
    down: ({pgClient}) => {
        return pgClient.query(`
            ALTER TABLE sessions
            DROP COLUMN IF EXISTS entrants;
        `);
    },
};

export default migration