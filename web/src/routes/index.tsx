import { useCallback, type FunctionComponent } from "react";

const Index: FunctionComponent = () => {
    const onStartClick = useCallback(() => {
        fetch(`${import.meta.env.VITE_API_BASE_URL}/session`, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                const sessionId = data.sessionId;
                window.location.href = `/s/${sessionId}`;
            })
            .catch(error => {
                console.error('Error creating session:', error);
            });
    }, []);

    return (
        <div className="index">
            <h1>Welcome to Judge!</h1>
            <p>Click the button below to create a session!</p>
            <button onClick={onStartClick}>Start!</button>
        </div>
    )
}

export {Index};
