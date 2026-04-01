import torch
import torch.nn as nn

class MTTSEPModel(nn.Module):
    def __init__(self):
        super().__init__()
        
        # Projection layers specifically constructed with LayerNorm + Relu
        self.proj_v = nn.Sequential(nn.Linear(576, 128), nn.LayerNorm(128), nn.ReLU())
        self.proj_a = nn.Sequential(nn.Linear(42, 128), nn.LayerNorm(128), nn.ReLU())
        self.proj_b = nn.Sequential(nn.Linear(5, 128), nn.LayerNorm(128), nn.ReLU())
        
        # Positional encoding for exactly 3 distinct multimodal tokens
        self.pos_emb = nn.Parameter(torch.randn(1, 3, 128))
        
        # TransformerEncoder backbone
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=128, nhead=4, dim_feedforward=512, dropout=0.2, batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=3)
        
        # Anomaly detection classification head
        self.head = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

    def forward(self, v, a, b):
        """Forward pass expecting batched vectors.
        v: (B, 576), a: (B, 42), b: (B, 5) -> returns suspicion prob (0-1)
        """
        # (B, 1, 128) mappings
        v_emb = self.proj_v(v).unsqueeze(1)
        a_emb = self.proj_a(a).unsqueeze(1)
        b_emb = self.proj_b(b).unsqueeze(1)
        
        # Concatenate on the sequence dimension -> (B, 3, 128)
        x = torch.cat([v_emb, a_emb, b_emb], dim=1)
        
        # Add learned positional encodings
        x = x + self.pos_emb
        
        # Run standard transformer
        x = self.transformer(x)
        
        # Mean pool over sequence length representing fused output
        x = torch.mean(x, dim=1) # (B, 128)
        
        # Binary Classifier yielding probability bound
        out = self.head(x) # (B, 1)
        return out

if __name__ == "__main__":
    # Internal test logic
    model = MTTSEPModel()
    v = torch.randn(2, 576)
    a = torch.randn(2, 42)
    b = torch.randn(2, 5)
    out = model(v, a, b)
    print(f"Model transformer output test form executed correctly. output vector bound -> {out.shape}")
