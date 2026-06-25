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
            input: `Handle these work items:
- item-1 (customer_message): "I was charged twice and need help."
- item-2 (bug_report): "The export button fails on Safari."
- item-3 (sales_request): "Can you send pricing for 50 seats?"`,
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
