import java.awt.Robot;
import java.awt.event.KeyEvent;

public class RobotHold {
    public static void main(String[] args) throws Exception {
        Robot robot = new Robot();
        int code = KeyEvent.class.getField("VK_" + args[0].toUpperCase()).getInt(null);
        int ms = Integer.parseInt(args[1]);
        robot.keyPress(code);
        robot.delay(ms);
        robot.keyRelease(code);
        System.out.println("held " + args[0] + " " + ms + "ms");
    }
}