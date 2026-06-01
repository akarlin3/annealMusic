// state.jsx — shared app context (defined before screens so they can read it)
const AppContext = React.createContext(null);
const useApp = () => React.useContext(AppContext);
Object.assign(window, { AppContext, useApp });
