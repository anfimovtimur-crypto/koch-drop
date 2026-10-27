import "./Contracts.css";

export default function Contracts({ setPage }) {
  function closePage() {
    if (typeof setPage === "function") {
      setPage("upgrade");
    }
  }

  return (
    <main className="contracts-unavailable">
      <div className="contracts-unavailable-content">
        <img
          className="contracts-unavailable-logo"
          src="/logo.png"
          alt="Koch Drop"
        />

        <h1>КОНТРАКТЫ НЕДОСТУПНЫ НА ДАННЫЙ МОМЕНТ</h1>

<h1> (Я ЧИНЮ ИХ) </h1>

        <button
          type="button"
          className="contracts-unavailable-close"
          onClick={closePage}
        >
          ЗАКРЫТЬ
        </button>
      </div>
    </main>
  );
}