type Session = {
    id: string;
    createdAt: string;
    name: string;
    endedAt: string | null;
}

type CreateSessionResponse = {
    sessionId: string;
}

const getSession = async (sessionId: string): Promise<Session> => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/session/${sessionId}`);
    const { session } = await response.json();
    return ({
        id: session.id,
        createdAt: session.createdAt,
        name: session.name,
        endedAt: session.endedAt,
    });
};

const createSession = async (): Promise<CreateSessionResponse> => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/session`, {
        method: 'POST',
    });
    const data = await response.json();
    return ({
        sessionId: data.sessionId,
    });
};

const getEntrantList = async (sessionId: string): Promise<string[] | null> => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/session/${sessionId}/entrants`);
    const data = await response.json();
    return data.entrants || [];
};

const updateEntrantList = async (sessionId: string, entrantList: string[]): Promise<void> => {
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/session/${sessionId}/entrants`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entrants: entrantList }),
    });
};

const registerJudge = async (sessionId: string, judgeName: string): Promise<string> => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/session/${sessionId}/judge`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: judgeName }),
    });
    const data = await response.json();
    return data.judgeId;
};

const updateScores = async (sessionId: string, judgeName: string, scores: Record<string, number>): Promise<void> => {
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/session/${sessionId}/score`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ judgeName, scores }),
    });
};

const getScores = async (sessionId: string, judgeName: string): Promise<Record<string, number>> => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/session/${sessionId}/score?judgeName=${encodeURIComponent(judgeName)}`);
    const data = await response.json();
    return data.scores;
};

export { getSession, createSession, getEntrantList, updateEntrantList, registerJudge, updateScores, getScores };
export type { Session, CreateSessionResponse };