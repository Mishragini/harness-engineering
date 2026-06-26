import "./App.css";
import { Button } from "./components/ui/button";
import { useHarnessSocket } from "./hooks/useHarnessSocket";

function App() {
  const { events, connected, send } = useHarnessSocket();
  return (
    <>
      <div>connected:{connected}</div>
      {JSON.stringify(events)}
      <Button
        disabled={!connected}
        onClick={() => {
          send({
            type: "submit_task",
            input: `Handle these work items:
tem-1 (billing): Customer cus_88121 says they were charged twice. Find the duplicate charge and tell them the exact refund amount (in dollars).
`,
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
