import { Migration } from 'lauf';

const migration: Migration = {
    id: '1763878994-fix-schema',
    description: 'Fix the schema',
    up: ({pgClient}) => {
        return pgClient.query(`
            CREATE TABLE IF NOT EXISTS entrants (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID REFERENCES sessions(id),
                name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS judges (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID REFERENCES sessions(id),
                name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS scores (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                entrant_id UUID REFERENCES entrants(id),
                judge_id UUID REFERENCES judges(id),
                score INT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_entrants_session_id ON entrants(session_id);
            CREATE INDEX IF NOT EXISTS idx_judges_session_id ON judges(session_id);
            CREATE INDEX IF NOT EXISTS idx_scores_entrant_id ON scores(entrant_id);
            CREATE INDEX IF NOT EXISTS idx_scores_judge_id ON scores(judge_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_score ON scores(entrant_id, judge_id);

            INSERT INTO entrants (session_id, name)
            SELECT id, unnest(entrants)
            FROM sessions
            WHERE entrants IS NOT NULL;

            ALTER TABLE sessions
            DROP COLUMN IF EXISTS entrants;
        `);
    },
    down: ({pgClient}) => {
        return pgClient.query(`
            ALTER TABLE sessions
            ADD COLUMN entrants TEXT[];

            UPDATE sessions
            SET entrants = subquery.entrant_names
            FROM (
                SELECT session_id, array_agg(name) AS entrant_names
                FROM entrants
                GROUP BY session_id
            ) AS subquery
            WHERE sessions.id = subquery.session_id;

            DROP TABLE IF EXISTS scores;
            DROP TABLE IF EXISTS judges;
            DROP TABLE IF EXISTS entrants;
        `);
    },
};

export default migration