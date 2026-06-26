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
Customer cus_88121 was charged twice and wants the duplicate refunded.
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
