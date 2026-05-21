import { Link } from "react-router";

export function LandingPage() {
  return (
    <div>
      <h1>Send files directly</h1>

      <Link to="/s">Send files</Link>
      <Link to="/r">Receive files</Link>
    </div>
  );
}
