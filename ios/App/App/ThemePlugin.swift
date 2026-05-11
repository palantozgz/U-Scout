import Foundation
import Capacitor
import UIKit

@objc(ThemePlugin)
public class ThemePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ThemePlugin"
    public let jsName = "Theme"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setBackgroundColor", returnType: CAPPluginReturnPromise)
    ]

    @objc func setBackgroundColor(_ call: CAPPluginCall) {
        guard let hex = call.getString("color") else {
            call.reject("Missing color parameter")
            return
        }
        DispatchQueue.main.async {
            let color = self.colorFromHex(hex)
            self.bridge?.viewController?.view.window?.backgroundColor = color
            call.resolve()
        }
    }

    private func colorFromHex(_ hex: String) -> UIColor {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if h.hasPrefix("#") { h = String(h.dropFirst()) }
        var rgb: UInt64 = 0
        Scanner(string: h).scanHexInt64(&rgb)
        let r = CGFloat((rgb >> 16) & 0xFF) / 255.0
        let g = CGFloat((rgb >> 8) & 0xFF) / 255.0
        let b = CGFloat(rgb & 0xFF) / 255.0
        return UIColor(red: r, green: g, blue: b, alpha: 1.0)
    }
}
