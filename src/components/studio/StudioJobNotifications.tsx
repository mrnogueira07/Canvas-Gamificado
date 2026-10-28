import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, LoaderCircle, X } from "lucide-react";
import { dismissStudioJob, getStudioJobs, isStudioJobRunning, subscribeStudioJobs } from "../../lib/studioJobs";
import "../../styles/studio/studio-jobs.css";

export function StudioJobNotifications({ userId }: { userId: string }) {
  const jobs = useSyncExternalStore(subscribeStudioJobs, getStudioJobs);
  return <aside className="studio-jobs" aria-label="Geração de aulas" aria-live="polite">
    {jobs.filter(job => job.userId === userId && !job.dismissed).map(job => <div className={`studio-job studio-job--${job.status}`} key={job.projectId}>
      {isStudioJobRunning(job) ? <LoaderCircle size={20} className="studio-job__spinner" /> : job.status === "error" ? <AlertCircle size={20} /> : <Check size={20} />}
      <div><strong>{job.title}</strong><p>{job.message}</p><Link to={`/studio/${job.kind}?id=${encodeURIComponent(job.projectId)}${job.status === "error" && !job.result ? "&retry=1" : ""}`}>{isStudioJobRunning(job) ? "Acompanhar geração" : job.status === "error" && !job.result ? "Tentar novamente" : "Abrir aula"}</Link></div>
      {!isStudioJobRunning(job) && <button type="button" aria-label="Dispensar notificação" onClick={() => dismissStudioJob(userId, job.projectId)}><X size={17} /></button>}
    </div>)}
  </aside>;
}
