import vendor.cn.zbx1425.mtrsteamloco.org.mozilla.javascript.*;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileReader;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 绂荤嚎鎵ц draw.js锛岀敤鍜屾父鎴忕浉鍚岀殑 Graphics2D 鍙傛暟杈撳嚭棰勮鍥俱€? * 鍙敤浜庡紑鍙戞牎瀵癸紝涓嶅弬涓庤祫婧愬寘鎵撳寘銆? */
public class DrawJsPreview {
    private static final Path ROOT = Path.of("D:\\crt_lcd_2012");
    private static final Path LCD = ROOT.resolve("resource-pack/assets/mtr/cqlcd");

    public static final class Resources {
        public String id(String value) {
            return value;
        }

        public String readString(String value) {
            try {
                return Files.readString(LCD.resolve("config.json"));
            } catch (Exception error) {
                throw new RuntimeException(error);
            }
        }

        public Font readFont(String value) {
            try {
                String path = value.substring("mtr:cqlcd/".length());
                return Font.createFont(Font.TRUETYPE_FONT, LCD.resolve(path).toFile());
            } catch (Exception error) {
                throw new RuntimeException(error);
            }
        }
    }

    public static final class TextUtil {
        public String getCjkParts(String value) {
            String text = String.valueOf(value);
            int bar = text.indexOf('|');
            return (bar >= 0) ? text.substring(0, bar) : text;
        }

        public String getNonCjkParts(String value) {
            String text = String.valueOf(value);
            int bar = text.indexOf('|');
            return (bar >= 0) ? text.substring(bar + 1) : "";
        }
    }

    public static void main(String[] args) throws Exception {
        Context cx = Context.enter();
        try {
            cx.setOptimizationLevel(-1);
            cx.setLanguageVersion(200);
            ImporterTopLevel scope = new ImporterTopLevel(cx);
            ScriptableObject.putProperty(scope, "Resources", Context.javaToJS(new Resources(), scope));
            ScriptableObject.putProperty(scope, "TextUtil", Context.javaToJS(new TextUtil(), scope));
            ScriptableObject.putProperty(scope, "STATUS_NO_ROUTE", "no_route");
            ScriptableObject.putProperty(scope, "include", new BaseFunction() {
                @Override
                public Object call(Context c, Scriptable s, Scriptable thisObj, Object[] args) {
                    try {
                        String name = String.valueOf(args[0]);
                        Path file = "js_util.js".equals(name) ? LCD.resolve(name) : ROOT.resolve(name);
                        try (java.io.Reader reader = new java.io.InputStreamReader(new java.io.FileInputStream(file.toFile()), java.nio.charset.StandardCharsets.UTF_8)) {
                            return c.evaluateReader(s, reader, name, 1, null);
                        }
                    } catch (Exception error) {
                        throw new RuntimeException(error);
                    }
                }
            });
            cx.evaluateString(scope, "importPackage(java.awt); importPackage(java.awt.geom);", "imports", 1, null);
            try (java.io.Reader reader = new java.io.InputStreamReader(new java.io.FileInputStream(LCD.resolve("draw.js").toFile()), java.nio.charset.StandardCharsets.UTF_8)) {
                cx.evaluateReader(scope, reader, "draw.js", 1, null);
            }

            Scriptable route = cx.newObject(scope);
            ScriptableObject.putProperty(route, "routeName", "1号线|Line 1");
            ScriptableObject.putProperty(route, "destination", "测试|Test");
            ScriptableObject.putProperty(route, "travelDirection", 1);
            ScriptableObject.putProperty(route, "routeColor", Context.javaToJS(new Color(0, 128, 0), scope));
            String[] stationNames = {
                    "测试A", "测试B", "测试C", "测试D", "测试E", "测试F",
                    "测试G", "测试H", "测试I", "测试J", "测试K", "测试L",
                    "测试M", "测试N", "测试O", "测试P", "测试Q", "测试R",
                    "测试S", "测试T", "测试U", "测试V", "测试W", "测试X",
                    "测试Y", "测试Z"
            };
            ScriptableObject.putProperty(route, "nextStationIndex", 12);
            Scriptable stations = cx.newArray(scope, stationNames.length);
            for (int i = 0; i < stationNames.length; i++) {
                Scriptable station = cx.newObject(scope);
                ScriptableObject.putProperty(station, "stationName", stationNames[i] + "|Test");
                Scriptable transfers = cx.newArray(scope, 0);
                if (i == 12) {
                    transfers = cx.newArray(scope, 5);
                    String[] transferNames = {"六号线|Line 6", "二号线|Line 2", "三号线|Line 3", "四号线|Line 4", "五号线|Line 5"};
                    Color[] transferColors = {new Color(255, 0, 160), new Color(0, 160, 220), new Color(0, 160, 80), new Color(230, 160, 0), new Color(150, 80, 200)};
                    for (int t = 0; t < transferNames.length; t++) {
                        Scriptable transfer = cx.newObject(scope);
                        ScriptableObject.putProperty(transfer, "name", transferNames[t]);
                        ScriptableObject.putProperty(transfer, "color", Context.javaToJS(transferColors[t], scope));
                        ScriptableObject.putProperty(transfer, "isConnectingStation", false);
                        transfers.put(t, transfers, transfer);
                    }
                }
                ScriptableObject.putProperty(station, "interchangeInfo", transfers);
                stations.put(i, stations, station);
            }
            ScriptableObject.putProperty(route, "stationInfoList", stations);

            Function drawScreen = (Function) scope.get("drawScreen", scope);
            Path output = ROOT.resolve("docs/preview/drawjs");
            Files.createDirectories(output);

            render(cx, scope, drawScreen, route, "door", "door.png", 1, false);
            renderDoorFrames(cx, scope, drawScreen, route);
            render(cx, scope, drawScreen, route, "full_route_map", "full-route-map.png", 1, false);
            render(cx, scope, drawScreen, route, "full_route_map", "full-route-map-26.png", 1, false);
            try {
                cx.evaluateString(scope, "ARROW_BLINK_PHASE_LOCK = 1;", "phase", 1, null);
                render(cx, scope, drawScreen, route, "full_route_map", "full-route-map-blink.png", 1, false);
                cx.evaluateString(scope, "ARROW_BLINK_PHASE_LOCK = 0;", "phase", 1, null);
            } catch (Exception ignored) {
            }
            render(cx, scope, drawScreen, route, "next_station", "segment.png", 1, false);
            try {
                cx.evaluateString(scope, "ARROW_BLINK_PHASE_LOCK = 1;", "phase", 1, null);
                render(cx, scope, drawScreen, route, "next_station", "segment-blink.png", 1, false);
                cx.evaluateString(scope, "ARROW_BLINK_PHASE_LOCK = 0;", "phase", 1, null);
            } catch (Exception ignored) {
            }
            ScriptableObject.putProperty(route, "nextStationIndex", 0);
            render(cx, scope, drawScreen, route, "next_station", "segment-start.png", 1, false);
            ScriptableObject.putProperty(route, "nextStationIndex", 25);
            render(cx, scope, drawScreen, route, "next_station", "segment-end.png", 1, false);
            ScriptableObject.putProperty(route, "nextStationIndex", 12);
            render(cx, scope, drawScreen, route, "consist", "consist.png", 1, false);
            render(cx, scope, drawScreen, route, "arrived", "arrived-open.png", 1, true);
            System.out.println("wrote " + output);
        } finally {
            Context.exit();
        }
    }

    private static void renderDoorFrames(Context cx, Scriptable scope, Function drawScreen, Scriptable route) throws Exception {
        Function setPreview = (Function) scope.get("setDoorPreviewFraction", scope);
        Function drawDoorPanel = (Function) scope.get("drawDoorPanel", scope);
        Path output = ROOT.resolve("docs/preview/drawjs/door-anim");
        Files.createDirectories(output);
        Object routeColor = route.get("routeColor", route);
        int frames = 40;
        for (int i = 0; i <= frames; i++) {
            double fraction = (double) i / frames;
            BufferedImage image = new BufferedImage(1123, 843, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = image.createGraphics();
            try {
                drawScreen.call(cx, scope, scope, new Object[]{
                        g, route, "on_route", "door", true, false, 1, false, false, true
                });
                setPreview.call(cx, scope, scope, new Object[]{fraction});
                drawDoorPanel.call(cx, scope, scope, new Object[]{
                        g, routeColor, "open", fraction, "left"
                });
            } finally {
                g.dispose();
            }
            ImageIO.write(image, "png", output.resolve(String.format("frame-%02d.png", i)).toFile());
        }
        setPreview.call(cx, scope, scope, new Object[]{null});
    }

    private static void render(Context cx, Scriptable scope, Function drawScreen, Scriptable route,
                               String page, String fileName, int coach, boolean openNow) throws Exception {
        BufferedImage image = new BufferedImage(1123, 843, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        try {
            Object result = drawScreen.call(cx, scope, scope, new Object[]{
                    g, route, "on_route", page, true, openNow, coach, true, false,
                    "door".equals(page) && !openNow
            });
            Context.javaToJS(result, scope);
        } finally {
            g.dispose();
        }
        ImageIO.write(image, "png", ROOT.resolve("docs/preview/drawjs").resolve(fileName).toFile());
    }
}

