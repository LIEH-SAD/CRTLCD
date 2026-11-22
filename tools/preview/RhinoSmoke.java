import vendor.cn.zbx1425.mtrsteamloco.org.mozilla.javascript.Context;
import vendor.cn.zbx1425.mtrsteamloco.org.mozilla.javascript.Scriptable;

public class RhinoSmoke {
    public static void main(String[] args) {
        Context cx = Context.enter();
        try {
            cx.setLanguageVersion(Context.VERSION_ES6);
            Scriptable scope = cx.initStandardObjects();
            Object result = cx.evaluateString(scope, "1 + 2", "smoke", 1, null);
            System.out.println("result=" + result);
        } finally {
            Context.exit();
        }
    }
}