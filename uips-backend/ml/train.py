import os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import roc_auc_score, classification_report, confusion_matrix
try:
    from ml.transformer import MTTSEPModel
except ImportError:
    from transformer import MTTSEPModel

class MultimodalExamDataset(Dataset):
    def __init__(self, data_path, split="train"):
        data = np.load(data_path)
        
        total_len = len(data["labels"])
        split_idx = int(total_len * 0.8)
        
        if split == "train":
            self.v = torch.tensor(data["visual_features"][:split_idx], dtype=torch.float32)
            self.a = torch.tensor(data["audio_features"][:split_idx], dtype=torch.float32)
            self.b = torch.tensor(data["behavior_features"][:split_idx], dtype=torch.float32)
            scores = data["suspicion_scores"][:split_idx]
        else:
            self.v = torch.tensor(data["visual_features"][split_idx:], dtype=torch.float32)
            self.a = torch.tensor(data["audio_features"][split_idx:], dtype=torch.float32)
            self.b = torch.tensor(data["behavior_features"][split_idx:], dtype=torch.float32)
            scores = data["suspicion_scores"][split_idx:]
            
        # BCE target metric maps true instances where synthetic suspicion_score boundary is violated >40
        self.targets = torch.tensor((scores > 40).astype(np.float32)).unsqueeze(-1)
        
    def __len__(self):
        return len(self.targets)
        
    def __getitem__(self, idx):
        return self.v[idx], self.a[idx], self.b[idx], self.targets[idx]

def train():
    base_dir = os.path.dirname(__file__)
    data_path = os.path.join(base_dir, "training_data", "dataset.npz")
    if not os.path.exists(data_path):
        print(f"Dataset not found at {data_path}. Execute generate_training_data.py first.")
        return

    train_dataset = MultimodalExamDataset(data_path, split="train")
    val_dataset = MultimodalExamDataset(data_path, split="val")
    
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = MTTSEPModel().to(device)
    
    criterion = nn.BCELoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=50)
    
    best_auc = 0.0
    val_targets_all = []
    val_preds_all = []
    
    models_dir = os.path.abspath(os.path.join(base_dir, "..", "trained_models"))
    os.makedirs(models_dir, exist_ok=True)
    
    print(f"Executing Training Sequence! Total epochs: 50 | Device bound: {device}")
    
    for epoch in range(50):
        model.train()
        train_loss = 0.0
        
        for v, a, b, target in train_loader:
            v, a, b, target = v.to(device), a.to(device), b.to(device), target.to(device)
            
            optimizer.zero_grad()
            out = model(v, a, b)
            loss = criterion(out, target)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * v.size(0)
            
        scheduler.step()
        train_loss = train_loss / len(train_dataset)
        
        # Validation 
        model.eval()
        val_loss = 0.0
        preds = []
        targets_list = []
        
        with torch.no_grad():
            for v, a, b, target in val_loader:
                v, a, b, target = v.to(device), a.to(device), b.to(device), target.to(device)
                out = model(v, a, b)
                loss = criterion(out, target)
                val_loss += loss.item() * v.size(0)
                
                preds.extend(out.cpu().numpy())
                targets_list.extend(target.cpu().numpy())
                
        val_loss = val_loss / len(val_dataset)
        
        preds = np.array(preds)
        targets_list = np.array(targets_list)
        
        # Compute metrics based on generic standard BCE > 0.5
        pred_labels = (preds > 0.5).astype(int)
        acc = np.mean(pred_labels == targets_list) * 100
        try:
            auc = roc_auc_score(targets_list, preds)
        except ValueError:
            auc = 0.0
            
        print(f"Epoch {epoch+1}/50 | Loss: {train_loss:.4f} | Val Acc: {acc:.1f}% | AUC: {auc:.4f}")
        
        if auc > best_auc:
            best_auc = auc
            model_save_path = os.path.join(models_dir, "mtt_sep.pth")
            torch.save(model.state_dict(), model_save_path)
            val_targets_all = targets_list
            val_preds_all = pred_labels
            
    print("\nTraining Sequence successfully mapped.")
    if best_auc > 0:
        print("Best Model Classification Report:")
        print(classification_report(val_targets_all, val_preds_all))
        print("Confusion Matrix:")
        print(confusion_matrix(val_targets_all, val_preds_all))
        print(f"Successfully saved weights bounding highest epoch -> {model_save_path}")

if __name__ == "__main__":
    train()
