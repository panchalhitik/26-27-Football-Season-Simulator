import { useGameStore } from '@/store';
import { LandingScreen } from '@/screens/LandingScreen';
import { ChooseClubScreen } from '@/screens/ChooseClubScreen';
import { BoardroomScreen } from '@/screens/BoardroomScreen';
import { ManagerDecisionScreen } from '@/screens/ManagerDecisionScreen';
import { WindowScreen } from '@/screens/WindowScreen';
import { SimulatingScreen } from '@/screens/SimulatingScreen';
import { MidSeasonScreen } from '@/screens/MidSeasonScreen';
import { FinalReportScreen } from '@/screens/FinalReportScreen';

export function App() {
  const phase = useGameStore((s) => s.phase);

  switch (phase) {
    case 'landing':            return <LandingScreen />;
    case 'choose-club':        return <ChooseClubScreen />;
    case 'boardroom':          return <BoardroomScreen />;
    case 'manager-decision':   return <ManagerDecisionScreen />;
    case 'window':             return <WindowScreen />;
    case 'january-window':     return <WindowScreen />;
    case 'simulating-h1':      return <SimulatingScreen half="h1" />;
    case 'mid-season':         return <MidSeasonScreen />;
    case 'simulating-h2':      return <SimulatingScreen half="h2" />;
    case 'final-report':       return <FinalReportScreen />;
    default:                   return <LandingScreen />;
  }
}
