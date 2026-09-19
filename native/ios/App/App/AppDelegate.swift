import UIKit
import WebKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}


// MARK: - Relay native shell

/// The Capacitor view controller with the native-only chrome layered on top.
///
/// The web app is served by the Relay API server and is owned by the frontend
/// author; nothing here edits it. Instead `www/chrome.css` and `www/chrome.js`
/// are bundled with this app and injected as `WKUserScript`s before the page
/// runs, which is what turns a responsive web layout into something that reads
/// as an iPhone app: a tab bar over the home indicator, content clear of the
/// notch, and a launch that always lands on the patient's own record.
///
/// Registered as the storyboard's view controller class in Base.lproj/Main.storyboard.
class RelayViewController: CAPBridgeViewController {

    /// Called after Capacitor has installed its own content controller, which is
    /// why the scripts are added here and not in `webViewConfiguration(for:)`:
    /// that one's controller is replaced before the web view is built.
    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        let script = shellScript()
        NSLog("[relay-native] webView(with:configuration:) called, script=%@ chars", script.map { String($0.count) } ?? "nil")
        if let script {
            configuration.userContentController.addUserScript(
                WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
            NSLog("[relay-native] user script added; total=%d", configuration.userContentController.userScripts.count)
        }
        return super.webView(with: frame, configuration: configuration)
    }

    /// `chrome.js` with the stylesheet bound to `RELAY_CSS_B64` in its scope.
    ///
    /// One script rather than two so the stylesheet cannot be added before the
    /// script that guards on `<html>` existing. The CSS travels base64-encoded
    /// so that braces, quotes and percent signs in it cannot terminate the
    /// JavaScript string literal carrying it.
    private func shellScript() -> String? {
        guard let js = shellResource(named: "chrome", ext: "js"),
              let css = shellResource(named: "chrome", ext: "css")
        else { return nil }
        return "var RELAY_CSS_B64 = '\(Data(css.utf8).base64EncodedString())';\n" + js
    }

    /// Dark glyphs: every Relay screen is on a light paper background.
    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    private func shellResource(named name: String, ext: String) -> String? {
        guard let url = Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "public")
        else {
            assertionFailure("Missing native shell resource \(name).\(ext); run `npm run sync` in native/")
            return nil
        }
        return try? String(contentsOf: url, encoding: .utf8)
    }
}
