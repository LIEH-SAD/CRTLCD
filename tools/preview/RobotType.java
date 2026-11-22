import java.awt.Robot;
import java.awt.event.KeyEvent;

public class RobotType {
    public static void main(String[] args) throws Exception {
        String text = args[0];
        boolean enter = args.length < 2 || !args[1].equals("noenter");
        Robot robot = new Robot();
        robot.keyPress(KeyEvent.VK_T);
        robot.delay(80);
        robot.keyRelease(KeyEvent.VK_T);
        robot.delay(350);
        for (char ch : text.toCharArray()) {
            boolean shift = Character.isUpperCase(ch);
            char lower = Character.toLowerCase(ch);
            int code;
            if (lower == '/') code = KeyEvent.VK_SLASH;
            else if (lower == ' ') code = KeyEvent.VK_SPACE;
            else if (lower == '-') code = KeyEvent.VK_MINUS;
            else if (lower == '.') code = KeyEvent.VK_PERIOD;
            else if (lower == ':') code = KeyEvent.VK_SEMICOLON;
            else code = KeyEvent.getExtendedKeyCodeForChar(lower);
            if (code == KeyEvent.VK_UNDEFINED) { System.out.println("cannot type " + ch); continue; }
            if (shift) robot.keyPress(KeyEvent.VK_SHIFT);
            robot.keyPress(code);
            robot.delay(25);
            robot.keyRelease(code);
            if (shift) robot.keyRelease(KeyEvent.VK_SHIFT);
            robot.delay(20);
        }
        if (enter) {
            robot.delay(200);
            robot.keyPress(KeyEvent.VK_ENTER);
            robot.delay(80);
            robot.keyRelease(KeyEvent.VK_ENTER);
        }
        System.out.println("typed " + text);
    }
}