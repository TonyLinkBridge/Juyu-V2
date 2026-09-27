import Link from 'next/link';
/** Visibility comes from current server authorization, never a browser role claim. */
export function OpsEntryLink({allowed}:{allowed:boolean}){return allowed?<Link className="secondary-link" href="/help-centre/ops">OPS Internal</Link>:null;}
