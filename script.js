// ---- HÀM LẤY THAM SỐ TỪ URL ----
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);

    // Kiểm tra nếu có tham số c (encoded content)
    const encodedContent = urlParams.get("c");
    if (encodedContent) {
        try {
            // Giải mã base64 đã được URL-safe
            const base64 = encodedContent.replace(/-/g, "+").replace(/_/g, "/");
            const decodedString = decodeURIComponent(escape(atob(base64)));
            const content = JSON.parse(decodedString);

            // Kiểm tra và trả về giá trị tương ứng
            if (name === "text" && content.text) return content.text;
            if (name === "text1" && content.text1) return content.text1;
            if (name === "text2" && content.text2) return content.text2;
            if (name === "loopText" && content.loopText) return content.loopText;
            if (name === "message" && content.message) return content.message;
            if (name === "instructions" && content.instructions)
                return content.instructions;
            if (name === "introduce" && content.introduce) return content.introduce;
            if (name === "music" && content.music) return content.music;
            if (name === "image" && content.image) return content.image;
            if (name === "name" && content.name) return content.name;
        } catch (e) {
            console.error("Lỗi khi giải mã Base64:", e);
        }
    }

    // Kiểm tra tham số thông thường trong URL (không mã hóa)
    const regularParam = urlParams.get(name);
    if (regularParam) {
        return regularParam;
    }

    // Trả về giá trị mặc định nếu không có trong URL
    if (name === "text2") return "Yêu em thật nhiều!";
    if (name === "music")
        return "https://cdn.shopify.com/s/files/1/0757/9700/4572/files/nhactrungthu2.mp3?v=1759336472"; // URL mặc định cho nhạc
    if (name === "introduce") return "Chạm vào trái tim để xem điều bất ngờ!"; // Giá trị mặc định cho tooltip

    return null;
}

// Global variables
let scene, camera, renderer, lanterns = [];
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let isPlaying = false;
let touchStartTime = 0;
let touchStartPos = {
    x: 0,
    y: 0
};
let isTouchActive = false;
let currentMessageIndex = 0; // Index để theo dõi câu chúc hiện tại
let isPopupOpen = false; // Prevent multiple popups
let lastClickTime = 0; // Debounce clicks

// Detect if device is mobile
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0);
}

// Show visual feedback for touch
function showTouchFeedback(x, y) {
    if (!isMobileDevice()) return;

    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        left: ${x - 15}px;
        top: ${y - 15}px;
        width: 30px;
        height: 30px;
        border: 2px solid rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        pointer-events: none;
        z-index: 1000;
        animation: touchFeedback 0.3s ease-out forwards;
    `;

    // Add CSS animation if not already added
    if (!document.getElementById('touch-feedback-style')) {
        const style = document.createElement('style');
        style.id = 'touch-feedback-style';
        style.textContent = `
            @keyframes touchFeedback {
                0% {
                    transform: scale(0.5);
                    opacity: 1;
                }
                100% {
                    transform: scale(1.5);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(feedback);

    // Remove feedback element after animation
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 300);
}

// Lấy tham số từ URL
const customMusic = getUrlParameter("music");
const customText = getUrlParameter("text");
const customImage = getUrlParameter("image");

// Popup background images (sử dụng ảnh từ URL hoặc mặc định)
let popupImages = [];
if (customImage) {
    popupImages = [customImage];
    console.log('Using custom image from URL:', customImage);
} else {
    popupImages = ['./popup1.jpeg', './popup2.jpeg', './popup3.jpeg', './popup4.jpeg'];
    console.log('Using default popup images');
}
let preloadedPopupImages = [];

// Popup messages (sử dụng text từ URL hoặc mặc định)
let popupMessages = [];
if (customText) {
    // Tách text theo dấu phẩy và loại bỏ khoảng trắng thừa
    popupMessages = customText.split(',').map(msg => msg.trim()).filter(msg => msg.length > 0);
} else {
    popupMessages = [
        "Trăng rằm sáng tỏ, tình anh dành cho em cũng sáng như thế. Chúc em Trung Thu an lành và hạnh phúc bên anh mãi mãi 💞.",
        "Trung Thu có trăng, có đèn lồng, và có em – niềm vui lớn nhất trong đời anh 🌙✨.",
        "Anh chẳng cần bánh nướng, bánh dẻo, chỉ cần em bên cạnh là Trung Thu đã trọn vẹn rồi 🍂💕."
    ];
}

// Initialize the 3D scene
function init() {
    // Create scene
    scene = new THREE.Scene();

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // Create renderer
    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.getElementById('three-container').appendChild(renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Create lanterns
    createLanterns();

    // Add event listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', onMouseClick);
    window.addEventListener('mousemove', onMouseMove);

    // Add touch events for mobile
    window.addEventListener('touchstart', onTouchStart, {
        passive: false
    });
    window.addEventListener('touchend', onTouchEnd, {
        passive: false
    });
    window.addEventListener('touchmove', onTouchMove, {
        passive: false
    });

    // Create stars
    createStars();

    // Create shooting stars
    createShootingStars();

    // Hide loading
    document.getElementById('loading').style.display = 'none';

    console.log('Scene initialized');
}

// Create 2D lantern sprites
function createLanterns() {
    const loader = new THREE.TextureLoader();

    // Load lantern texture from long2.jpeg
    loader.load('./long2.jpeg', function(texture) {
        // Process texture to remove background and make it transparent
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Get image data to process transparency
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Process pixels to make background transparent
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Check if pixel is close to white/light background (adjust threshold as needed)
                if (r > 200 && g > 200 && b > 200) {
                    data[i + 3] = 0; // Make transparent
                }
                // Check for striped pattern colors (gray/light colors)
                else if (r > 150 && g > 150 && b > 150 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
                    data[i + 3] = 0; // Make transparent
                }
            }

            ctx.putImageData(imageData, 0, 0);
            const processedTexture = new THREE.CanvasTexture(canvas);

            createTransparentLanterns(processedTexture);
        };

        img.src = texture.image.src;
    }, undefined, function(error) {
        console.error('Error loading lantern texture:', error);
        // Create fallback 2D lanterns
        createFallback2DLanterns();
    });
}

function createTransparentLanterns(processedTexture) {
    // Create multiple 2D lantern sprites with perspective depth effect
    // Use fewer lanterns on mobile for better performance
    const lanternCount = isMobileDevice() ? 150 : 250;
    for (let i = 0; i < lanternCount; i++) {
        // Create sprite material with the processed lantern image
        const spriteMaterial = new THREE.SpriteMaterial({
            map: processedTexture,
            transparent: true,
            opacity: 0.95,
            alphaTest: 0.1 // This helps with transparency
        });

        // Create sprite (2D image that always faces camera)
        const lantern = new THREE.Sprite(spriteMaterial);

        // Random starting position with extended depth range
        lantern.position.x = (Math.random() - 0.5) * 30; // Even wider spread
        lantern.position.y = -15 - Math.random() * 12; // Start much lower for more variety
        lantern.position.z = (Math.random() - 0.5) * 35; // Much deeper range (-17.5 to 17.5)

        // Calculate distance from camera for perspective scaling with more dramatic effect
        const distanceFromCamera = Math.abs(lantern.position.z) + 8; // Add base distance
        const scaleFactor = Math.max(0.2, 15 / distanceFromCamera); // More dramatic scaling: Near: very large, Far: very small

        // Set size based on distance with more variety
        const sizeVariation = 0.7 + Math.random() * 0.6; // Random size variation (0.7x to 1.3x)
        const baseWidth = 1.8 * scaleFactor * sizeVariation;
        const baseHeight = 2.4 * scaleFactor * sizeVariation;
        lantern.scale.set(baseWidth, baseHeight, 1);

        // Adjust opacity based on distance - far lanterns are more transparent
        const opacityFactor = Math.max(0.3, 1 - (Math.abs(lantern.position.z) / 35));
        spriteMaterial.opacity = 0.95 * opacityFactor;


        // Add point light for each lantern
        const pointLight = new THREE.PointLight(0xffaa00, 0.6, 4);
        pointLight.position.set(0, 0, 0.2);
        lantern.add(pointLight);

        // Add properties for animation with depth-based variations
        lantern.userData = {
            originalY: lantern.position.y,
            speed: (0.008 + Math.random() * 0.015) * scaleFactor, // Closer lanterns move slightly faster
            swayAmount: (Math.random() * 0.5 + 0.2) * scaleFactor,
            swaySpeed: Math.random() * 0.02 + 0.01,
            phase: Math.random() * Math.PI * 2,
            delay: Math.random() * 4000, // Longer delay range for more variety
            scaleFactor: scaleFactor,
            baseWidth: baseWidth,
            baseHeight: baseHeight,
            distanceFromCamera: distanceFromCamera
        };

        scene.add(lantern);
        lanterns.push(lantern);
    }

    console.log(`Created ${lanterns.length} 2D transparent lanterns using processed long2.jpeg`);
}

// Create fallback 2D lanterns without texture
function createFallback2DLanterns() {
    // Use fewer lanterns on mobile for better performance
    const lanternCount = isMobileDevice() ? 150 : 250;
    for (let i = 0; i < lanternCount; i++) {
        // Create a simple 2D lantern using canvas
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 160;
        const context = canvas.getContext('2d');

        // Draw a simple lantern shape
        const gradient = context.createLinearGradient(0, 0, 0, 160);
        gradient.addColorStop(0, '#ff6600');
        gradient.addColorStop(0.5, '#ffaa00');
        gradient.addColorStop(1, '#ff8800');

        // Main lantern body
        context.fillStyle = gradient;
        context.fillRect(30, 40, 60, 80);

        // Top cap
        context.fillStyle = '#cc5500';
        context.fillRect(25, 35, 70, 10);

        // Bottom cap
        context.fillRect(25, 115, 70, 10);

        // Decorative lines
        context.strokeStyle = '#ffdd00';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(30, 60);
        context.lineTo(90, 60);
        context.moveTo(30, 80);
        context.lineTo(90, 80);
        context.moveTo(30, 100);
        context.lineTo(90, 100);
        context.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9
        });

        const lantern = new THREE.Sprite(spriteMaterial);

        // Extended positioning with depth - match main lanterns
        lantern.position.x = (Math.random() - 0.5) * 30;
        lantern.position.y = -15 - Math.random() * 12;
        lantern.position.z = (Math.random() - 0.5) * 35;

        // Calculate perspective scaling for fallback lanterns too - match main lanterns
        const distanceFromCamera = Math.abs(lantern.position.z) + 8;
        const scaleFactor = Math.max(0.2, 15 / distanceFromCamera);
        const sizeVariation = 0.7 + Math.random() * 0.6;
        const baseWidth = 1.8 * scaleFactor * sizeVariation;
        const baseHeight = 2.4 * scaleFactor * sizeVariation;
        lantern.scale.set(baseWidth, baseHeight, 1);

        // Adjust opacity based on distance - match main lanterns
        const opacityFactor = Math.max(0.3, 1 - (Math.abs(lantern.position.z) / 35));
        spriteMaterial.opacity = 0.9 * opacityFactor;


        // Add point light
        const pointLight = new THREE.PointLight(0xffaa00, 0.6, 4);
        pointLight.position.set(0, 0, 0.2);
        lantern.add(pointLight);

        lantern.userData = {
            originalY: lantern.position.y,
            speed: (0.008 + Math.random() * 0.015) * scaleFactor,
            swayAmount: (Math.random() * 0.5 + 0.2) * scaleFactor,
            swaySpeed: Math.random() * 0.02 + 0.01,
            phase: Math.random() * Math.PI * 2,
            delay: Math.random() * 4000,
            scaleFactor: scaleFactor,
            baseWidth: baseWidth,
            baseHeight: baseHeight,
            distanceFromCamera: distanceFromCamera
        };

        scene.add(lantern);
        lanterns.push(lantern);
    }

    console.log(`Created ${lanterns.length} fallback 2D lanterns`);
}

// Create stars background
function createStars() {
    const starsContainer = document.getElementById('stars');

    for (let i = 0; i < 200; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.width = Math.random() * 3 + 1 + 'px';
        star.style.height = star.style.width;
        star.style.animationDelay = Math.random() * 2 + 's';
        starsContainer.appendChild(star);
    }
}

// Create shooting stars
function createShootingStars() {
    const shootingStarsContainer = document.getElementById('shooting-stars');
    if (!shootingStarsContainer) return;

    // Create multiple shooting stars with random positions and delays
    const numShootingStars = 20; // Increased number of shooting stars

    for (let i = 0; i < numShootingStars; i++) {
        const shootingStar = document.createElement('div');
        shootingStar.className = 'shooting-star';

        // Random starting positions (top-right area for diagonal movement)
        const startX = Math.random() * (window.innerWidth * 0.8) + (window.innerWidth * 0.2);
        const startY = Math.random() * (window.innerHeight * 0.3);

        shootingStar.style.left = startX + 'px';
        shootingStar.style.top = startY + 'px';

        // Random animation delay (0-10 seconds)
        const delay = Math.random() * 10;
        shootingStar.style.animationDelay = delay + 's';

        // Add some size variation
        const size = 3 + Math.random() * 3; // 3-6px
        shootingStar.style.width = size + 'px';
        shootingStar.style.height = size + 'px';

        shootingStarsContainer.appendChild(shootingStar);
    }

    console.log(`Created ${numShootingStars} shooting stars`);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (isPlaying) {
        const time = Date.now() * 0.001;

        // Animate lanterns
        lanterns.forEach((lantern, index) => {
            if (Date.now() > lantern.userData.delay) {
                // Float upward
                lantern.position.y += lantern.userData.speed;

                // Sway side to side
                lantern.position.x += Math.sin(time * lantern.userData.swaySpeed + lantern.userData.phase) * 0.01;

                // Gentle floating motion for 2D sprites (no rotation needed for sprites)

                // Reset position when lantern goes off screen
                if (lantern.position.y > 20) {
                    lantern.position.y = -15 - Math.random() * 12;
                    lantern.position.x = (Math.random() - 0.5) * 30;
                    lantern.position.z = (Math.random() - 0.5) * 35;
                    lantern.userData.delay = Date.now() + Math.random() * 3000;

                    // Recalculate scaling for new position with improved depth
                    const newDistanceFromCamera = Math.abs(lantern.position.z) + 8;
                    const newScaleFactor = Math.max(0.2, 15 / newDistanceFromCamera);
                    const newSizeVariation = 0.7 + Math.random() * 0.6;
                    lantern.scale.set(1.8 * newScaleFactor * newSizeVariation, 2.4 * newScaleFactor * newSizeVariation, 1);

                    // Update opacity based on new distance
                    const newOpacityFactor = Math.max(0.3, 1 - (Math.abs(lantern.position.z) / 35));
                    if (lantern.material) {
                        lantern.material.opacity = 0.95 * newOpacityFactor;
                    }

                    // Update user data
                    lantern.userData.scaleFactor = newScaleFactor;
                    lantern.userData.speed = (0.008 + Math.random() * 0.015) * newScaleFactor;
                    lantern.userData.swayAmount = (Math.random() * 0.5 + 0.2) * newScaleFactor;
                }
            }
        });
    }

    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Recreate shooting stars for new window size
    const shootingStarsContainer = document.getElementById('shooting-stars');
    if (shootingStarsContainer) {
        shootingStarsContainer.innerHTML = '';
        createShootingStars();
    }
}

// Handle mouse movement
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// Handle touch start
function onTouchStart(event) {
    if (!isPlaying) return;

    event.preventDefault();
    const touch = event.touches[0];
    touchStartTime = Date.now();
    touchStartPos.x = touch.clientX;
    touchStartPos.y = touch.clientY;
    isTouchActive = true;

    // Update mouse position for raycasting
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

    // Add visual feedback for touch
    showTouchFeedback(touch.clientX, touch.clientY);
}

// Handle touch move
function onTouchMove(event) {
    if (!isTouchActive) return;

    event.preventDefault();
    const touch = event.touches[0];

    // Update mouse position for raycasting
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
}

// Handle touch end
function onTouchEnd(event) {
    if (!isPlaying || !isTouchActive) return;

    event.preventDefault();
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;

    // Only trigger if it's a quick tap (less than 500ms) and minimal movement
    const touch = event.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    const maxMovement = 15; // Increased for better mobile tolerance

    if (touchDuration < 500 && deltaX < maxMovement && deltaY < maxMovement) {
        // Prevent multiple rapid touches
        const currentTime = Date.now();
        if (currentTime - lastClickTime < 500 || isPopupOpen) {
            console.log('Touch ignored - too soon or popup already open');
            isTouchActive = false;
            return;
        }

        // Update mouse position for raycasting
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

        console.log('Mobile touch detected at:', mouse.x, mouse.y);

        // Perform raycasting with mobile optimization
        performMobileRaycast();
    }

    isTouchActive = false;
}

// Perform raycasting to detect lantern clicks with debounce
function performRaycast() {
    if (!isPlaying) return;

    // Prevent multiple rapid clicks
    const currentTime = Date.now();
    if (currentTime - lastClickTime < 500 || isPopupOpen) {
        console.log('Click ignored - too soon or popup already open');
        return;
    }
    lastClickTime = currentTime;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(lanterns);

    if (intersects.length > 0) {
        showPopup();
        animateLanternClick(intersects[0].object);
    } else {
        // Fallback: if no lantern is hit, try a broader search
        // This helps with mobile devices where raycasting might be less precise
        performFallbackClick();
    }
}

// Enhanced mobile raycasting with debounce
function performMobileRaycast() {
    // Prevent multiple rapid clicks
    const currentTime = Date.now();
    if (currentTime - lastClickTime < 500 || isPopupOpen) {
        console.log('Click ignored - too soon or popup already open');
        return;
    }
    lastClickTime = currentTime;

    // First try normal raycasting
    raycaster.setFromCamera(mouse, camera);
    let intersects = raycaster.intersectObjects(lanterns);

    if (intersects.length > 0) {
        console.log('Direct hit on lantern!');
        showPopup();
        animateLanternClick(intersects[0].object);
        return;
    }

    // Enhanced fallback with larger search area for mobile
    const fallbackRays = [{
            x: mouse.x,
            y: mouse.y
        },
        {
            x: mouse.x - 0.08,
            y: mouse.y
        },
        {
            x: mouse.x + 0.08,
            y: mouse.y
        },
        {
            x: mouse.x,
            y: mouse.y - 0.08
        },
        {
            x: mouse.x,
            y: mouse.y + 0.08
        },
        {
            x: mouse.x - 0.06,
            y: mouse.y - 0.06
        },
        {
            x: mouse.x + 0.06,
            y: mouse.y - 0.06
        },
        {
            x: mouse.x - 0.06,
            y: mouse.y + 0.06
        },
        {
            x: mouse.x + 0.06,
            y: mouse.y + 0.06
        }
    ];

    for (let ray of fallbackRays) {
        raycaster.setFromCamera(ray, camera);
        intersects = raycaster.intersectObjects(lanterns);

        if (intersects.length > 0) {
            console.log('Fallback hit on lantern!');
            showPopup();
            animateLanternClick(intersects[0].object);
            return;
        }
    }

    // If still no hit, show popup anyway (mobile fallback)
    if (isMobileDevice()) {
        console.log('Mobile fallback - showing popup anyway');
        showPopup();
    }
}

// Separate function for lantern click animation
function animateLanternClick(lantern) {
    const originalScale = lantern.scale.clone();

    // Scale animation
    lantern.scale.multiplyScalar(1.2);
    setTimeout(() => {
        lantern.scale.copy(originalScale);
    }, 200);
}

// Fallback click mechanism for desktop with debounce
function performFallbackClick() {
    // Prevent multiple rapid clicks
    const currentTime = Date.now();
    if (currentTime - lastClickTime < 500 || isPopupOpen) {
        console.log('Click ignored - too soon or popup already open');
        return;
    }
    lastClickTime = currentTime;

    // Create a larger raycaster with multiple rays around the touch point
    const fallbackRays = [{
            x: mouse.x,
            y: mouse.y
        },
        {
            x: mouse.x - 0.05,
            y: mouse.y
        },
        {
            x: mouse.x + 0.05,
            y: mouse.y
        },
        {
            x: mouse.x,
            y: mouse.y - 0.05
        },
        {
            x: mouse.x,
            y: mouse.y + 0.05
        }
    ];

    for (let ray of fallbackRays) {
        raycaster.setFromCamera(ray, camera);
        const intersects = raycaster.intersectObjects(lanterns);

        if (intersects.length > 0) {
            showPopup();
            animateLanternClick(intersects[0].object);
            break; // Exit after first successful hit
        }
    }
}

// Handle mouse click
function onMouseClick(event) {
    if (!isPlaying) return;

    performRaycast();
}

// Show popup with protection against multiple instances
function showPopup() {
    // Prevent multiple popups
    if (isPopupOpen) {
        console.log('Popup already open, ignoring request');
        return;
    }

    isPopupOpen = true;
    const popup = document.getElementById('popup');

    // Set popup background and optional image area
    try {
        if (customImage) {
            // Khi có ảnh từ URL, giữ nền gradient nhẹ để chữ dễ đọc
            popup.style.backgroundImage = 'linear-gradient(135deg, rgba(0,0,0,0.35), rgba(0,0,0,0.5))';
            popup.style.backgroundSize = 'cover';
            popup.style.backgroundPosition = 'center';
            popup.style.backgroundRepeat = 'no-repeat';
            popup.style.color = '#ffffff';
        } else {
            // Không có ảnh URL → dùng ảnh nền mặc định ngẫu nhiên
            const imageSrc = popupImages[Math.floor(Math.random() * popupImages.length)];
            console.log('Setting random popup background:', imageSrc);
            popup.style.backgroundImage = `url('${imageSrc}')`;
            popup.style.backgroundSize = 'cover';
            popup.style.backgroundPosition = 'center';
            popup.style.backgroundRepeat = 'no-repeat';
            popup.style.color = '#ffffff';
        }
    } catch (e) {
        console.warn('Failed to set popup background image', e);
        popup.style.backgroundImage = `linear-gradient(135deg, rgba(0,0,0,0.35), rgba(0,0,0,0.5))`;
    }

    // Show popup message in sequence, and show image (from URL) above the message if available
    try {
        // Lấy câu chúc theo thứ tự (không random)
        const currentMessage = popupMessages[currentMessageIndex % popupMessages.length];

        // Tăng index cho lần click tiếp theo
        currentMessageIndex++;

        console.log(`Showing message ${currentMessageIndex} of ${popupMessages.length}:`, currentMessage);

        const imageBlock = customImage ? `
            <img 
                src="${customImage}"
                alt="popup"
                style="
                    max-width: 100%;
                    height: auto;
                    border-radius: 12px;
                    margin: 0 auto 14px auto;
                    display: block;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
                "
                onerror="this.style.display='none'"
            />
        ` : '';

        popup.innerHTML = `
            <button class="close-popup" onclick="closePopup()" aria-label="Đóng popup">&times;</button>
            ${imageBlock}
            <div style="padding: 12px 0; font-family: 'Arial', sans-serif; word-wrap: break-word; overflow-wrap: break-word;">
                ${currentMessage}
            </div>
        `;

        // Add touch event listener for close button on mobile
        const closeBtn = popup.querySelector('.close-popup');
        if (closeBtn && isMobileDevice()) {
            closeBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (isPopupOpen) {
                    closePopup();
                }
            }, {
                passive: false
            });
        }
    } catch (e) {
        console.warn('Failed to set popup message', e);
        const fallbackImageBlock = customImage ? `
            <img 
                src="${customImage}"
                alt="popup"
                style="
                    max-width: 100%;
                    height: auto;
                    border-radius: 12px;
                    margin: 0 auto 14px auto;
                    display: block;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
                "
                onerror="this.style.display='none'"
            />
        ` : '';
        popup.innerHTML = `
            <button class="close-popup" onclick="closePopup()" aria-label="Đóng popup">&times;</button>
            ${fallbackImageBlock}
            <div style="padding: 12px 0; font-family: 'Arial', sans-serif; word-wrap: break-word; overflow-wrap: break-word;">
                Anh Yêu Em ❤️
            </div>
        `;

        // Add touch event listener for fallback close button on mobile
        const fallbackCloseBtn = popup.querySelector('.close-popup');
        if (fallbackCloseBtn && isMobileDevice()) {
            fallbackCloseBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (isPopupOpen) {
                    closePopup();
                }
            }, {
                passive: false
            });
        }
    }

    popup.classList.add('show');

    // Add click/touch outside to close functionality
    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
        if (isMobileDevice()) {
            document.addEventListener('touchend', handleTouchOutside, {
                passive: false
            });
        }
    }, 100);
}

// Handle click outside popup to close
function handleClickOutside(event) {
    const popup = document.getElementById('popup');
    if (popup && popup.classList.contains('show') && !popup.contains(event.target) && isPopupOpen) {
        closePopup();
    }
}

// Handle touch outside popup to close (mobile specific)
function handleTouchOutside(event) {
    const popup = document.getElementById('popup');
    if (popup && popup.classList.contains('show') && !popup.contains(event.target) && isPopupOpen) {
        event.preventDefault();
        closePopup();
    }
}

// Close popup
function closePopup() {
    const popup = document.getElementById('popup');
    popup.classList.remove('show');

    // Reset popup state
    isPopupOpen = false;

    // Remove the click/touch outside event listeners
    document.removeEventListener('click', handleClickOutside);
    if (isMobileDevice()) {
        document.removeEventListener('touchend', handleTouchOutside);
    }
}

// Reset message index (có thể gọi khi cần reset thứ tự)
function resetMessageIndex() {
    currentMessageIndex = 0;
    console.log('Message index reset to 0');
}

// Start the experience
function startExperience() {
    isPlaying = true;
}

// Play background music with multiple attempts
function playBackgroundMusic() {
    const audio = document.getElementById('backgroundMusic');
    if (audio) {
        // Cập nhật src nếu có nhạc từ URL
        if (customMusic) {
            audio.src = customMusic;
            // Load lại audio sau khi thay đổi src
            audio.load();
        }

        // Unmute the audio and set volume to a comfortable level (30%)
        audio.muted = false;
        audio.volume = 0.3;

        // Function to attempt playing music
        const attemptPlayMusic = (retries = 3) => {
            // Try to play muted first, then unmute
            audio.muted = true;
            const playPromise = audio.play();

            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Unmute after successful play
                    setTimeout(() => {
                        audio.muted = false;
                        console.log('Background music started successfully and unmuted');
                    }, 100);
                    // Hide music button if it exists
                    const musicBtn = document.querySelector('.music-play-button');
                    if (musicBtn) {
                        musicBtn.remove();
                    }
                }).catch(error => {
                    console.log('Autoplay attempt failed:', error);
                    if (retries > 0) {
                        // Try again after a short delay
                        setTimeout(() => {
                            attemptPlayMusic(retries - 1);
                        }, 1000);
                    } else {
                        // All attempts failed, enable interaction-based playback
                        enableInteractionPlayback();
                    }
                });
            }
        };

        // Nếu có custom music, đợi load xong
        if (customMusic) {
            audio.addEventListener('canplaythrough', () => attemptPlayMusic(), {
                once: true
            });
        } else {
            // Nhạc mặc định, phát ngay
            attemptPlayMusic();
        }
    }
}

// Enable music playback on user interaction
function enableInteractionPlayback() {
    const audio = document.getElementById('backgroundMusic');
    if (!audio) return;

    let musicStarted = false;

    const startMusicOnInteraction = () => {
        if (musicStarted) return;

        // Unmute and play
        audio.muted = false;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Music started after user interaction');
                musicStarted = true;
                // Remove all event listeners
                document.removeEventListener('click', startMusicOnInteraction);
                document.removeEventListener('touchstart', startMusicOnInteraction);
                document.removeEventListener('keydown', startMusicOnInteraction);
                // Hide music button and autoplay message if they exist
                const musicBtn = document.querySelector('.music-play-button');
                const autoplayMsg = document.querySelector('.autoplay-message');
                if (musicBtn) {
                    musicBtn.remove();
                }
                if (autoplayMsg) {
                    autoplayMsg.remove();
                }
            }).catch(error => {
                console.log('Music play failed even after interaction:', error);
                showMusicPlayButton();
            });
        }
    };

    // Add event listeners for user interactions
    document.addEventListener('click', startMusicOnInteraction, {
        once: true
    });
    document.addEventListener('touchstart', startMusicOnInteraction, {
        once: true
    });
    document.addEventListener('keydown', startMusicOnInteraction, {
        once: true
    });

    // Show a subtle notification
    showAutoplayMessage();
}

// Show subtle autoplay message
function showAutoplayMessage() {
    const message = document.createElement('div');
    message.innerHTML = 'Chạm vào màn hình để bắt đầu nhạc nền 🎵';
    message.className = 'autoplay-message';
    message.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 999;
        backdrop-filter: blur(10px);
        animation: autoplayPulse 2s ease-in-out infinite;
        pointer-events: none;
    `;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes autoplayPulse {
            0%, 100% { opacity: 0.7; transform: translateX(-50%) scale(1); }
            50% { opacity: 1; transform: translateX(-50%) scale(1.05); }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(message);

    // Remove message after 5 seconds
    setTimeout(() => {
        if (message.parentNode) {
            message.parentNode.removeChild(message);
        }
    }, 5000);
}

// Show music play button if autoplay is blocked (fallback)
function showMusicPlayButton() {
    // Check if button already exists
    if (document.querySelector('.music-play-button')) return;

    const musicButton = document.createElement('button');
    musicButton.innerHTML = '🎵 Phát nhạc';
    musicButton.className = 'music-play-button';
    musicButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        z-index: 1001;
        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
        transition: all 0.3s ease;
        opacity: 0.9;
    `;

    const playMusic = () => {
        const audio = document.getElementById('backgroundMusic');
        if (audio) {
            audio.muted = false;
            audio.play().then(() => {
                console.log('Music started via button click');
                musicButton.remove();
                // Also remove autoplay message if it exists
                const autoplayMsg = document.querySelector('.autoplay-message');
                if (autoplayMsg) {
                    autoplayMsg.remove();
                }
            }).catch(error => {
                console.log('Music play failed:', error);
                musicButton.innerHTML = '❌ Lỗi nhạc';
                setTimeout(() => {
                    if (musicButton.parentNode) {
                        musicButton.remove();
                    }
                }, 2000);
            });
        }
    };

    musicButton.addEventListener('click', playMusic);
    musicButton.addEventListener('touchend', playMusic);

    musicButton.addEventListener('mouseenter', () => {
        musicButton.style.transform = 'scale(1.05)';
        musicButton.style.opacity = '1';
    });

    musicButton.addEventListener('mouseleave', () => {
        musicButton.style.transform = 'scale(1)';
        musicButton.style.opacity = '0.9';
    });

    document.body.appendChild(musicButton);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    init();
    animate();

    // Auto start the experience
    startExperience();

    // Start background music
    playBackgroundMusic();

    // Preload popup images
    preloadedPopupImages = popupImages.map(src => {
        const img = new Image();
        img.onload = function() {
            console.log('Popup image preloaded successfully:', src);
        };
        img.onerror = function() {
            console.warn('Failed to preload popup image:', src);
        };
        img.src = src;
        return img;
    });

    // Log thông tin về ảnh được sử dụng
    if (customImage) {
        console.log('Custom popup image will be used:', customImage);
    } else {
        console.log('Default popup images will be used:', popupImages);
    }

    // Log thông tin về câu chúc
    console.log(`Total messages loaded: ${popupMessages.length}`);
    console.log('Messages will be shown in sequence:', popupMessages);

    // Close popup on escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closePopup();
        }
    });

    // Add instructions for mobile users
    if (isMobileDevice()) {
        console.log('Mobile device detected - optimized touch controls enabled');

        // Add visual hint for mobile users
        const mobileHint = document.createElement('div');
        mobileHint.innerHTML = 'Chạm vào đèn lồng để xem lời chúc! 🏮';
        mobileHint.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 999;
            backdrop-filter: blur(10px);
            animation: fadeInOut 4s ease-in-out;
        `;

        // Add CSS animation for mobile hint
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(mobileHint);

        // Remove hint after animation
        setTimeout(() => {
            if (mobileHint.parentNode) {
                mobileHint.parentNode.removeChild(mobileHint);
            }
        }, 4000);
    }
});

// Handle page visibility change
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        isPlaying = false;
    } else {
        isPlaying = true;
    }
});