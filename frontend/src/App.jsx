import React from "react";
import KanbanBoard from "./components/KanbanBoard";

function App() {
  console.log("App component rendered");
  
  return (
    <div className="App">
      <h1>Real-time Kanban Board</h1>
      <KanbanBoard />
    </div>
  );
}

export default App;
