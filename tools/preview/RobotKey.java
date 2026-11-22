import java.awt.Robot;
import java.awt.event.KeyEvent;

public class RobotKey {
    public static void main(String[] args) throws Exception {
        Robot robot = new Robot();
        int code;
        if (args[0].matches("\\d+")) code = Integer.parseInt(args[0]);
        else code = KeyEvent.class.getField("VK_" + args[0].toUpperCase()).getInt(null);
        robot.keyPress(code);
        robot.delay(80);
        robot.keyRelease(code);
        System.out.println("pressed " + args[0]);
    }
}