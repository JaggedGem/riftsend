import { useParams } from "react-router";

export function ReceiverPage() {
  const { code } = useParams();

  return (
    <div>
      <h1>Receiver view</h1>
      {code && <p>Joining room: {code}</p>}
    </div>
  );
}
