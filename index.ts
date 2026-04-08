import { registerRootComponent } from "expo";

import App from "./App";
import { ensureWebBootScreen } from "./src/bootstrap/webBootScreen";

ensureWebBootScreen();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
