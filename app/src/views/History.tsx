import { ArrowClockwise, BookOpenText, DownloadSimple } from "@phosphor-icons/react";
import { type RunLog } from "../data";
import { guideForFailure, type GuideId } from "../guides";

export function History(props: {
  logs: RunLog[];
  retryable: Set<string>;
  onOpenUpdates(): void;
  onOpenGuide(id: GuideId): void;
  onRetry(actionIds: string[]): void;
}) {
  const { logs, retryable, onOpenUpdates, onOpenGuide, onRetry } = props;
  const runs = logs.filter((log) => log.mode !== "dry-run");
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">History</h1>
      </div>
      {runs.length === 0 && (
        <section className="pane first-run">
          <p className="empty">No updates have been installed from here yet. Each install you run shows up here, with what worked and what didn't.</p>
          <button className="button" onClick={onOpenUpdates}>
            <DownloadSimple size={18} aria-hidden="true" />
            Choose updates
          </button>
        </section>
      )}
      {runs.map((log) => {
        const count = (result: string) => log.actions.filter((a) => a.result === result).length;
        const failed = log.actions.filter((a) => a.result === "failed");
        const started = new Date(log.startedAt);
        return (
          <section className="pane run" key={log.startedAt}>
            <div className="run-when">
              <h2 className="section-title">{started.toLocaleDateString(undefined, { dateStyle: "long" })}</h2>
              <p>{started.toLocaleTimeString(undefined, { timeStyle: "short" })}</p>
            </div>
            <div className="run-body">
              <div className="run-ticks" aria-hidden="true">
                {log.actions.map((action) => <i key={action.actionId} data-result={action.result} />)}
              </div>
              <p className="run-counts">
                <b>{count("succeeded")}</b> installed, <b>{count("failed")}</b> failed, <b>{count("skipped")}</b> skipped
              </p>
              {failed.length > 0 && (
                <ul className="rows">
                  {failed.map((action) => (
                    <li className="row" key={action.actionId}>
                      <span className="row-title">{action.title}</span>
                      <span className="result" data-result="failed">Failed</span>
                      {action.reason && <p>{action.reason}</p>}
                      <div className="row-actions">
                        <button className="link" onClick={() => onOpenGuide(guideForFailure(action.reason))}>
                          <BookOpenText size={16} aria-hidden="true" />
                          What to do
                        </button>
                        {/* Retry only offers what the current list still has; Updates asks to confirm. */}
                        {retryable.has(action.actionId) && (
                          <button className="link" onClick={() => onRetry([action.actionId])}>
                            <ArrowClockwise size={16} aria-hidden="true" />
                            Retry
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
