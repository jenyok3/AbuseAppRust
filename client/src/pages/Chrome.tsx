import { useEffect } from "react";

export default function Chrome() {
  useEffect(() => {
    document.body.style.backgroundColor = "#000000";
    document.body.style.backgroundImage = "none";
    document.body.style.background = "#000000";

    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.backgroundImage = "";
      document.body.style.background = "";
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-black text-white flex items-center justify-center"
      style={{ backgroundColor: "#000000" }}
    >
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white/80 mb-4">В розробці</h1>
        <p className="text-white/60">Сторінка знаходиться в процесі розробки</p>
      </div>
    </div>
  );
}
