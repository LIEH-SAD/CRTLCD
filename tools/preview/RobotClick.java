import java.awt.Robot;
import java.awt.event.InputEvent;

public class RobotClick {
    public static void main(String[] args) throws Exception {
        int x = Integer.parseInt(args[0]);
        int y = Integer.parseInt(args[1]);
        Robot robot = new Robot();
        robot.mouseMove(x, y);
        robot.delay(200);
        robot.mousePress(InputEvent.BUTTON1_DOWN_MASK);
        robot.delay(80);
        robot.mouseRelease(InputEvent.BUTTON1_DOWN_MASK);
        System.out.println("clicked " + x + "," + y);
    }
}