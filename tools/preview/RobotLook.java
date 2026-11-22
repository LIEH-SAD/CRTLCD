import java.awt.Robot;

public class RobotLook {
    public static void main(String[] args) throws Exception {
        int dx = Integer.parseInt(args[0]);
        int dy = Integer.parseInt(args[1]);
        Robot robot = new Robot();
        // Move in a few small steps so the game receives relative deltas.
        int cx = 640, cy = 360;
        robot.mouseMove(cx, cy);
        robot.delay(100);
        int steps = 12;
        for (int i = 1; i <= steps; i++) {
            robot.mouseMove(cx + dx * i / steps, cy + dy * i / steps);
            robot.delay(30);
        }
        System.out.println("looked " + dx + "," + dy);
    }
}