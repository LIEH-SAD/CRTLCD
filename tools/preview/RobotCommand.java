import java.awt.Robot;
import java.awt.event.KeyEvent;

public class RobotCommand {
    public static void main(String[] args) throws Exception {
        String text = args[0];
        Robot robot = new Robot();
        // Make sure no screen/chat is already open, then open command chat with '/'.
        robot.keyPress(KeyEvent.VK_ESCAPE); robot.delay(60); robot.keyRelease(KeyEvent.VK_ESCAPE);
        robot.delay(300);
        robot.keyPress(KeyEvent.VK_SLASH); robot.delay(60); robot.keyRelease(KeyEvent.VK_SLASH);
        robot.delay(400);
        for (char ch : text.toCharArray()) {
            boolean shift = Character.isUpperCase(ch);
            char lower = Character.toLowerCase(ch);
            int code;
            if (lower == ' ') code = KeyEvent.VK_SPACE;
            else if (lower == '-') code = KeyEvent.VK_MINUS;
            else if (lower == '.') code = KeyEvent.VK_PERIOD;
            else if (lower == ':') code = KeyEvent.VK_SEMICOLON;
            else if (lower == '@') { shift = true; code = KeyEvent.VK_2; }
            else code = KeyEvent.getExtendedKeyCodeForChar(lower);
            if (code == KeyEvent.VK_UNDEFINED) continue;
            if (shift) robot.keyPress(KeyEvent.VK_SHIFT);
            robot.keyPress(code); robot.delay(25); robot.keyRelease(code);
            if (shift) robot.keyRelease(KeyEvent.VK_SHIFT);
            robot.delay(15);
        }
        robot.delay(250);
        robot.keyPress(KeyEvent.VK_ENTER); robot.delay(80); robot.keyRelease(KeyEvent.VK_ENTER);
        robot.delay(400);
        robot.keyPress(KeyEvent.VK_ESCAPE); robot.delay(60); robot.keyRelease(KeyEvent.VK_ESCAPE);
        System.out.println("command " + text);
    }
}