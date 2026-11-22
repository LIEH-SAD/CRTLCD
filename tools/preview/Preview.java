import vendor.cn.zbx1425.mtrsteamloco.org.mozilla.javascript.BaseFunction;
import vendor.cn.zbx1425.mtrsteamloco.org.mozilla.javascript.NativeJavaClass;
import vendor.cn.zbx1425.mtrsteamloco.org.mozilla.javascript.Context;
import vendor.cn.zbx1425.mtrsteamloco.org.mozilla.javascript.Scriptable;
import vendor.cn.zbx1425.mtrsteamloco.org.mozilla.javascript.ScriptableObject;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public class Preview {
    static Path assetRoot;
    static Path lcdDir;

    public static class ResId {
        public final String id;
        public ResId(String id) { this.id = id; }
        public String toString() { return id; }
    }

    public static class Resources {
        public ResId id(String id) { return new ResId(id); }
        public String readString(ResId id) throws IOException {
            return new String(Files.readAllBytes(assetRoot.resolve(id.id.replace(':', '/'))), StandardCharsets.UTF_8);
        }
        public Font readFont(ResId id) throws Exception {
            Path p = assetRoot.resolve(id.id.replace(':', '/'));
            Font f = Font.createFont(Font.TRUETYPE_FONT, p.toFile());
            return f.deriveFont(28f);
        }
        public BufferedImage readBufferedImage(ResId id) throws IOException {
            return ImageIO.read(assetRoot.resolve(id.id.replace(':', '/')).toFile());
        }
    }

    public static class TextUtil {
        public static String getCjkParts(String src) {
            if (src == null) return "";
            int i = src.indexOf('|');
            return i < 0 ? src : src.substring(0, i);
        }
        public static String getNonCjkParts(String src) {
            if (src == null) return "";
            int i = src.indexOf('|');
            if (i < 0) return src;
            String rest = src.substring(i + 1);
            int j = rest.indexOf("||");
            if (j >= 0) rest = rest.substring(j + 2);
            return rest;
        }
        public static String getNonExtraParts(String src) {
            if (src == null) return "";
            int i = src.indexOf("||");
            return i < 0 ? src : src.substring(0, i);
        }
    }

    static class IncludeFunction extends BaseFunction {
        public Object call(Context cx, Scriptable scope, Scriptable thisObj, Object[] args) {
            String name = Context.toString(args[0]);
            Path file = lcdDir.resolve(name);
            try (Reader reader = new InputStreamReader(Files.newInputStream(file), StandardCharsets.UTF_8)) {
                return cx.evaluateReader(scope, reader, file.toString(), 1, null);
            } catch (IOException e) {
                throw Context.reportRuntimeError("Unable to include " + file + ": " + e);
            }
        }
    }

    static class PrintFunction extends BaseFunction {
        public Object call(Context cx, Scriptable scope, Scriptable thisObj, Object[] args) {
            for (Object arg : args) System.out.print(Context.toString(arg));
            System.out.println();
            return Context.getUndefinedValue();
        }
    }

    static void put(Scriptable scope, String name, Object value) {
        ScriptableObject.putProperty(scope, name, Context.javaToJS(value, scope));
    }

    static void putClass(Scriptable scope, String name, Class<?> value) {
        ScriptableObject.putProperty(scope, name, new NativeJavaClass(scope, value));
    }

    static String jsString(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    public static void main(String[] args) throws Exception {
        Path project = Path.of("D:/crt_lcd_2012");
        assetRoot = project.resolve("resource-pack/assets");
        lcdDir = assetRoot.resolve("mtr/cqlcd");
        Path outDir = project.resolve("docs/preview");
        Files.createDirectories(outDir);

        Context cx = Context.enter();
        try {
            cx.setLanguageVersion(Context.VERSION_ES6);
            cx.setOptimizationLevel(-1);
            Scriptable scope = cx.initStandardObjects();
            put(scope, "Resources", new Resources());
            putClass(scope, "TextUtil", TextUtil.class);
            ScriptableObject.putProperty(scope, "include", new IncludeFunction());
            ScriptableObject.putProperty(scope, "print", new PrintFunction());
            ScriptableObject.putProperty(scope, "importPackage", new BaseFunction() {
                public Object call(Context cx, Scriptable s, Scriptable t, Object[] a) { return Context.getUndefinedValue(); }
            });
            putClass(scope, "Color", Color.class);
            putClass(scope, "Font", Font.class);
            putClass(scope, "BasicStroke", java.awt.BasicStroke.class);
            putClass(scope, "GradientPaint", java.awt.GradientPaint.class);
            putClass(scope, "RenderingHints", java.awt.RenderingHints.class);
            putClass(scope, "Graphics2D", Graphics2D.class);
            putClass(scope, "GeneralPath", java.awt.geom.GeneralPath.class);
            putClass(scope, "AffineTransform", java.awt.geom.AffineTransform.class);
            putClass(scope, "Arc2D", java.awt.geom.Arc2D.class);
            putClass(scope, "AlphaComposite", java.awt.AlphaComposite.class);

            evalFile(cx, scope, lcdDir.resolve("js_util.js"));
            evalFile(cx, scope, lcdDir.resolve("mtr_util.js"));
            evalFile(cx, scope, lcdDir.resolve("draw.js"));

            String[] stations = {
                "璧山|Bishan", "尖顶坡|Jiandingpo", "大学城|Daxuecheng", "陈家桥|Chenjiaqiao",
                "微电园|Weidianyuan", "赖家桥|Laijiaqiao", "双碑|Shuangbei", "石井坡|Shijingpo",
                "磁器口|Ciqikou", "烈士墓|Lieshimu", "杨公桥|Yanggongqiao", "沙坪坝|Shapingba", "马家岩|Majiayan",
                "小龙坎|Xiaolongkan", "高庙村|Gaomiaocun", "石桥铺|Shiqiaopu", "歇台子|XietaiZi",
                "石油路|Shiyoulu", "大坪|Daping", "鹅岭|Eling", "两路口|Lianglukou",
                "七星岗|Qixinggang", "较场口|Jiaochangkou", "小什字|Xiaoshizi", "朝天门|Chaotianmen"
            };
            StringBuilder arr = new StringBuilder("[\n");
            for (int i = 0; i < stations.length; i++) {
                if (i > 0) arr.append(",\n");
                arr.append("{platformId:").append(i + 1)
                   .append(",stationName:").append(jsString(stations[i]))
                   .append(",interchangeInfo:[]}");
            }
            arr.append("\n]");
            String setup = "var ROUTE = {" +
                "routeName:" + jsString("重庆轨道交通1号线|Chongqing Metro Line 1") + "," +
                "routeColor:new Color((226<<16)|(0<<8)|24)," +
                "destination:" + jsString("朝天门|Chaotianmen") + "," +
                "route:{name:" + jsString("重庆轨道交通1号线") + ",color:(226<<16),circularState:'NONE'}," +
                "nextRoute:null,depotName:'车厂|Depot',stationInfoList:" + arr + "," +
                "nextStationIndex:1,travelDirection:1};";
            cx.evaluateString(scope, setup, "mock", 1, null);

            String[] names = {"full", "next", "consist", "door-blocked", "door-will-open", "arrived-open", "arrived-blocked"};
            for (String name : names) {
                BufferedImage image = new BufferedImage(getInt(scope, "WIDTH"), getInt(scope, "HEIGHT"), BufferedImage.TYPE_INT_ARGB);
                Graphics2D g = image.createGraphics();
                g.setColor(Color.WHITE);
                g.fillRect(0, 0, image.getWidth(), image.getHeight());
                String call;
                switch (name) {
                    case "full": call = "drawScreen(g, ROUTE, 'on_route', 'full_route_map', false, false, 1, true, false);"; break;
                    case "next": call = "drawScreen(g, ROUTE, 'on_route', 'next_station', false, false, 1, true, false);"; break;
                    case "consist": call = "drawScreen(g, ROUTE, 'on_route', 'consist', false, false, 1, true, false);"; break;
                    case "door-blocked": call = "drawScreen(g, ROUTE, 'on_route', 'door', false, false, 1, true, false);"; break;
                    case "door-will-open": call = "drawScreen(g, ROUTE, 'on_route', 'door', true, false, 1, true, false);"; break;
                    case "arrived-open": call = "drawScreen(g, ROUTE, 'arrived', 'arrived', true, true, 1, true, false);"; break;
                    default: call = "drawScreen(g, ROUTE, 'arrived', 'arrived', false, false, 1, true, false);"; break;
                }
                ScriptableObject.putProperty(scope, "g", Context.javaToJS(g, scope));
                cx.evaluateString(scope, call, name, 1, null);
                g.dispose();
                File out = outDir.resolve(name + ".png").toFile();
                ImageIO.write(image, "png", out);
                System.out.println("wrote " + out);
            }
        } finally {
            Context.exit();
        }
    }

    static void evalFile(Context cx, Scriptable scope, Path file) throws IOException {
        try (Reader reader = new InputStreamReader(Files.newInputStream(file), StandardCharsets.UTF_8)) {
            cx.evaluateReader(scope, reader, file.toString(), 1, null);
        }
    }

    static int getInt(Scriptable scope, String name) {
        Object v = ScriptableObject.getProperty(scope, name);
        return (int) Context.toNumber(v);
    }
}