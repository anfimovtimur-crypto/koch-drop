
import { useEffect, useState } from "react";

import Navbar from "./components/Navbar";
import Cases from "./components/Cases";
import Profile from "./components/Profile";
import Upgrade from "./components/Upgrade";
import Footer from "./components/Footer";
import Withdraw from "./components/Withdraw";
import Contracts from "./components/Contracts";
import TopSlider from "./components/TopSlider";
import Toast from "./components/Toast";
import Event from "./components/Event";
import Bonuses from "./components/Bonuses";
import DropTicker from "./components/DropTicker";

import "./App.css";

const STEAM_FUNCTION =
  "https://rmkszfhwqxomrcowesiu.supabase.co/functions/v1/smart-handler";

function loadStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function App() {
  const [inventory, setInventory] = useState(() =>
    loadStorage("koch_inventory", [])
  );

  const [page, setPage] = useState(() =>
    loadStorage("koch_page", "upgrade")
  );

  const [balance, setBalanceState] = useState(0);

  const [steamUser, setSteamUser] = useState(() => {
    try {
      const saved = localStorage.getItem("koch_steam_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    loadSteamAccount();
  }, []);

  async function loadSteamAccount() {
    try {
      let token = localStorage.getItem("koch_steam_token");
      const hash = window.location.hash;

      if (hash.includes("steam_token=")) {
        const params = new URLSearchParams(hash.substring(1));
        const hashToken = params.get("steam_token");

        if (hashToken) {
          token = hashToken;
          localStorage.setItem("koch_steam_token", hashToken);

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );
        }
      }

      if (!token) {
        setSteamUser(null);
        setBalanceState(0);
        setBalanceLoaded(true);
        return;
      }

      const response = await fetch(
        `${STEAM_FUNCTION}?action=me`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.user) {
        localStorage.removeItem("koch_steam_token");
        localStorage.removeItem("koch_steam_user");

        setSteamUser(null);
        setBalanceState(0);
        setBalanceLoaded(true);
        return;
      }

      setSteamUser(data.user);

      localStorage.setItem(
        "koch_steam_user",
        JSON.stringify(data.user)
      );

      setBalanceState(Number(data.user.balance || 0));
      setBalanceLoaded(true);
    } catch (error) {
      console.error("Ошибка Steam:", error);
      setBalanceLoaded(true);
    }
  }

  function setBalance(value) {
    setBalanceState(value);
  }

  useEffect(() => {
    if (!balanceLoaded || !steamUser) {
      return;
    }

    saveBalance(balance);
  }, [balance, steamUser, balanceLoaded]);

  async function saveBalance(value) {
    const token = localStorage.getItem("koch_steam_token");

    if (!token) {
      return;
    }

    try {
      await fetch(`${STEAM_FUNCTION}?action=balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          balance: Number(value) || 0
        })
      });
    } catch (error) {
      console.error("Ошибка сохранения баланса:", error);
    }
  }

  async function logoutSteam() {
    const token = localStorage.getItem("koch_steam_token");

    if (token) {
      try {
        await fetch(`${STEAM_FUNCTION}?action=logout`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error("Ошибка выхода:", error);
      }
    }

    localStorage.removeItem("koch_steam_token");
    localStorage.removeItem("koch_steam_user");
    localStorage.removeItem("koch_balance");

    setSteamUser(null);
    setBalanceState(0);
    setBalanceLoaded(false);
    setPage("upgrade");
  }

  useEffect(() => {
    localStorage.setItem("koch_inventory", JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem("koch_page", JSON.stringify(page));
  }, [page]);

  return (
    <div className="app">
      <DropTicker />

      <Navbar
        page={page}
        setPage={setPage}
        balance={balance}
        steamUser={steamUser}
        onLogin={() => {
          window.location.href = `${STEAM_FUNCTION}?action=login`;
        }}
      />

      <Toast message={toast} />

      <main className="main-content">
        {page === "home" ? null : page === "cases" ? (
          <>
            <TopSlider />

            <Cases
              balance={balance}
              setBalance={setBalance}
              inventory={inventory}
              setInventory={setInventory}
            />
          </>
        ) : page === "upgrade" ? (
          <Upgrade
            balance={balance}
            setBalance={setBalance}
            inventory={inventory}
            setInventory={setInventory}
          />
        ) : page === "profile" ? (
          <Profile
            balance={balance}
            inventory={inventory}
            setBalance={setBalance}
            setInventory={setInventory}
            steamUser={steamUser}
            onLogout={logoutSteam}
          />
        ) : page === "bonuses" ? (
          <Bonuses
            balance={balance}
            setBalance={setBalance}
            setToast={setToast}
          />
        ) : page === "withdraw" ? (
          <Withdraw
            balance={balance}
            setBalance={setBalance}
          />
        ) : page === "contracts" ? (
          <Contracts
            inventory={inventory}
            setInventory={setInventory}
            balance={balance}
            setBalance={setBalance}
            setPage={setPage}
          />
        ) : page === "event" ? (
          <Event
            inventory={inventory}
            setInventory={setInventory}
            balance={balance}
            setBalance={setBalance}
          />
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

export default App;
