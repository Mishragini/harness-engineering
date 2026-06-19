import "./App.css";
import { Button } from "./components/ui/button";
import { useHarnessSocket } from "./hooks/useHarnessSocket";

function App() {
  const { events, connected, send } = useHarnessSocket();
  return (
    <>
      {connected}
      {JSON.stringify(events)}
      <Button
        onClick={() => {
          send({
            type: "submit_task",
            input: "some task to do",
            mode: "default",
          });
        }}
      >
        Hello
      </Button>
    </>
  );
}

export default App;
