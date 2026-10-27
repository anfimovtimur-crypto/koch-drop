
import "./Navbar.css";

function Navbar({
  page,
  setPage,
  balance,
  steamUser,
  onLogin
}) {
  return (
    <nav className="kd-navbar">
      <div className="kd-navbar-inner">
        <img
          src="/logo.png"
          alt="Koch Drop"
          className="kd-logo"
          onClick={() => setPage("upgrade")}
        />

<button
  className={`kd-link ${page === "contracts" ? "active" : ""}`}
  onClick={() => setPage("contracts")}
>
  Контракты
</button>

        <div className="kd-links">
          <button
            className={`kd-link ${page === "upgrade" ? "active" : ""}`}
            onClick={() => setPage("upgrade")}
          >
            Апгрейд
          </button>

          

          <button
            className={`kd-link ${page === "bonuses" ? "active" : ""}`}
            onClick={() => setPage("bonuses")}
          >
            Бонусы
          </button>

          <button
            className={`kd-link ${page === "withdraw" ? "active" : ""}`}
            onClick={() => setPage("withdraw")}
          >
            Вывод
          </button>
        </div>

        {steamUser ? (
          <button
            className="kd-profile"
            onClick={() => setPage("profile")}
          >
            <div className="kd-avatar-wrap">
              <img
                src={steamUser.avatar || "/avatar.png"}
                alt=""
                className="kd-avatar"
              />
            </div>

            <div className="kd-profile-info">
              <span className="kd-name">
                {steamUser.persona_name || "Steam"}
              </span>

              <span className="kd-balance">
                {Number(balance || 0).toLocaleString("ru-RU")} ₽
              </span>
            </div>

            <span className="kd-arrow">→</span>
          </button>
        ) : (
          <button
            type="button"
            className="kd-steam-login"
            onClick={onLogin}
          >
            Войти через Steam
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
