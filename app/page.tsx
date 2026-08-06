import type { Metadata } from "next";
import GameShell from "./game/GameShell";

export const metadata: Metadata = {
  title: "Aurora Ascent — Aventura 3D",
  description: "Escale as ilhas do céu, colete os fragmentos solares e liberte o farol.",
};

export default function Home() {
  return <GameShell />;
}
