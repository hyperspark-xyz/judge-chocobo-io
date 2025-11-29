import { useLoaderData } from "@tanstack/react-router";
import { useEffect, useState, type FunctionComponent } from "react";
import { getScores, registerJudge, updateScores } from "../api";
import { ScoresComponent, type Scores } from "../components/ScoresComponent";
import styles from "./SessionJudgePage.module.css";

const SessionJudgePage: FunctionComponent = () => {
    const {session, entrants} = useLoaderData({ from: '/s/$sessionId/judge' });
    const sessionUsernameKey = `${session.id}-username`
    const [usernameInput, setUsernameInput] = useState('');
    const [sessionUsername, setSessionUsername] = useState(localStorage.getItem(sessionUsernameKey));
    const [scores, setScores] = useState<Scores>({});
    const [entrantList, setEntrantList] = useState<string[]>(entrants || []);
    const [socket, setSocket] = useState<WebSocket | null>(null);

    useEffect(() => {
        console.log("Entrant list updated:", entrantList);
        if (sessionUsername) {
            getScores(session.id, sessionUsername)
                .then(retrievedScores => {
                    const newScores: Scores = {};
                    for (const entrant of entrantList) {
                        newScores[entrant] = retrievedScores[entrant] || 0;
                    }
                    setScores(newScores);
                });
        }
    }, [entrantList, sessionUsername]);

    useEffect(() => {
        if (socket || !sessionUsername) {
            return;
        }

        console.log("Opening WebSocket connection");

        const ws = new WebSocket(`${import.meta.env.VITE_WS_BASE_URL}/ws?sessionId=${session.id}&judgeName=${sessionUsername}`);

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            console.log("Received WebSocket message:", message);

            if (message.type === 'entrantAdded') {
                setEntrantList((prevEntrants) => prevEntrants.concat(message.entrant));
            }
            else if (message.type === 'entrantRemoved') {
                setEntrantList((prevEntrants) => prevEntrants.filter(e => !message.entrantIds.includes(e)));
            }
        };

        setSocket(ws);

        window.onbeforeunload = () => {
            ws.close();
        };

        return () => {
            ws.close();
        };
    }, [sessionUsername]);

    return (
        <div className={styles.sessionJudgePage}>
            {!sessionUsername ? (
                <>
                    <h1>Set Judge Username</h1>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        localStorage.setItem(sessionUsernameKey, usernameInput);
                        setSessionUsername(usernameInput);
                        registerJudge(session.id, usernameInput);
                    }}>
                        <input 
                            type="text" 
                            onChange={(e) => setUsernameInput(e.target.value)} 
                            value={usernameInput} />
                        <button type="submit">Set Username</button>
                    </form>
                </>
            ) : (
                <>
                    <h1>Welcome, Judge {sessionUsername}!</h1>
                    <div className={styles.scores}>
                        <ScoresComponent scores={scores} onScoresChange={(scores) => {
                            updateScores(session.id, sessionUsername, scores);
                            setScores(scores);
                        }}/>
                    </div>
                </>
            )}
        </div>
    );
}

export {SessionJudgePage};