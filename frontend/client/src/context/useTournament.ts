import { createContext, useContext } from "react";
import type { Tournament } from "../domain/types";

export interface TournamentContextType {
  tournaments: Tournament[];
  activeTournament: Tournament | null;
  activeTournamentId: number | null;
  setActiveTournamentId: (id: number) => void;
  refreshTournaments: () => Promise<void>;
  loadingTournaments: boolean;
  canManageActiveTournament: boolean;
}

export const TournamentContext = createContext<TournamentContextType | null>(null);

export function useTournament(): TournamentContextType {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error("useTournament must be used within a TournamentProvider");
  }
  return context;
}
