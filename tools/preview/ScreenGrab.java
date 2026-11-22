import javax.imageio.ImageIO;
import java.awt.Rectangle;
import java.awt.Robot;
import java.awt.Toolkit;
import java.awt.image.BufferedImage;
import java.io.File;

public class ScreenGrab {
    public static void main(String[] args) throws Exception {
        Robot robot = new Robot();
        Rectangle screen = new Rectangle(Toolkit.getDefaultToolkit().getScreenSize());
        BufferedImage image = robot.createScreenCapture(screen);
        ImageIO.write(image, "png", new File(args.length > 0 ? args[0] : "screen.png"));
        System.out.println(screen.width + "x" + screen.height);
    }
}