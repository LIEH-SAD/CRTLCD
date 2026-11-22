import java.awt.Robot;
import java.awt.Toolkit;
import java.awt.datatransfer.StringSelection;
import java.awt.event.KeyEvent;

public class RobotChat {
    public static void main(String[] args) throws Exception {
        String text = args[0];
        Toolkit.getDefaultToolkit().getSystemClipboard().setContents(new StringSelection(text), null);
        Robot robot = new Robot();
        robot.keyPress(KeyEvent.VK_T);
        robot.delay(80);
        robot.keyRelease(KeyEvent.VK_T);
        robot.delay(300);
        robot.keyPress(KeyEvent.VK_CONTROL);
        robot.keyPress(KeyEvent.VK_V);
        robot.delay(80);
        robot.keyRelease(KeyEvent.VK_V);
        robot.keyRelease(KeyEvent.VK_CONTROL);
        robot.delay(150);
        robot.keyPress(KeyEvent.VK_ENTER);
        robot.delay(80);
        robot.keyRelease(KeyEvent.VK_ENTER);
        System.out.println("sent " + text);
    }
}