import java.awt.Robot;
import java.awt.event.InputEvent;

public class RobotRightClick {
    public static void main(String[] args) throws Exception {
        Robot robot = new Robot();
        robot.mouseMove(960, 540);
        robot.delay(250);
        robot.mousePress(InputEvent.BUTTON3_DOWN_MASK);
        robot.delay(90);
        robot.mouseRelease(InputEvent.BUTTON3_DOWN_MASK);
        System.out.println("right clicked");
    }
}