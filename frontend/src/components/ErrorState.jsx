import { AlertIcon } from "./Icons";

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <p>
        <AlertIcon /> {message}
      </p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
