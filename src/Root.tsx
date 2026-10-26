import { lazy, Suspense } from "react";
import Landing from "./Landing";

const Dashboard = lazy(() => import("./Dashboard"));

export default function Root() {
  const Screen = window.location.pathname === "/app" || window.location.pathname.startsWith("/app/") ? Dashboard : Landing;
  return <Suspense fallback={<div className="route-loading" aria-label="Loading Vocalis AI"><span /></div>}><Screen /></Suspense>;
}
