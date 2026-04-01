import os
import cv2
import torch
import torchvision.transforms as T
from torchvision.models import mobilenet_v3_small

class VisualEncoder:
    def __init__(self):
        # Use MobileNetV3-Small without pretrained weights to speed up deployment as per spec
        self.model = mobilenet_v3_small(pretrained=False)
        self.feature_extractor = self.model.features
        self.pool = torch.nn.AdaptiveAvgPool2d(1)
        self.model.eval()
        
        self.transform = T.Compose([
            T.ToPILImage(),
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        casc_dir = os.path.dirname(__file__)
        self.cascade_path = os.path.join(casc_dir, "haarcascade_frontalface_default.xml")
        if not os.path.exists(self.cascade_path):
            cascade_url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml"
            import urllib.request
            try:
                urllib.request.urlretrieve(cascade_url, self.cascade_path)
            except Exception as e:
                print("Failed to download HAAR Cascade:", e)
                
        self.face_cascade = cv2.CascadeClassifier(self.cascade_path)

    def extract_visual_features(self, image_path: str) -> torch.Tensor:
        """Extract 576-d visual features from image."""
        if not os.path.exists(image_path):
            return torch.zeros((576,), dtype=torch.float32)
            
        img = cv2.imread(image_path)
        if img is None:
            return torch.zeros((576,), dtype=torch.float32)
            
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        tensor_img = self.transform(img).unsqueeze(0)
        
        with torch.no_grad():
            features = self.feature_extractor(tensor_img)
            pooled = self.pool(features)
            flattened = torch.flatten(pooled, 1).squeeze(0)
            
        return flattened

    def detect_face(self, image_path: str) -> dict:
        """Detect faces using haar cascades."""
        result = {"face_detected": False, "face_count": 0, "anomaly_type": None}
        if not os.path.exists(image_path) or self.face_cascade.empty():
            return result
            
        img = cv2.imread(image_path)
        if img is None:
            return result
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        count = len(faces)
        result["face_count"] = count
        
        if count == 0:
            result["anomaly_type"] = "face_absent"
        elif count > 1:
            result["anomaly_type"] = "multiple_faces"
            result["face_detected"] = True
        else:
            result["face_detected"] = True
            
        return result

if __name__ == "__main__":
    enc = VisualEncoder()
    # Dummy test
    print("Visual encoder init successful.")
