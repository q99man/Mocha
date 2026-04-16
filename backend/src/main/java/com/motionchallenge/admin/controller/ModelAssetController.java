package com.motionchallenge.admin.controller;

import com.motionchallenge.admin.dto.ModelAssetResponse;
import com.motionchallenge.admin.service.ModelAssetService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/model-assets")
public class ModelAssetController {

    private final ModelAssetService modelAssetService;

    public ModelAssetController(ModelAssetService modelAssetService) {
        this.modelAssetService = modelAssetService;
    }

    @GetMapping("/pose-landmarker")
    public List<ModelAssetResponse> getPoseLandmarkerAssets() {
        return modelAssetService.getPoseLandmarkerAssets();
    }

    @GetMapping("/pose-landmarker/active")
    public ModelAssetResponse getActivePoseLandmarkerAsset() {
        return modelAssetService.getActivePoseLandmarkerAsset();
    }

    @PostMapping(path = "/pose-landmarker", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ModelAssetResponse uploadPoseLandmarker(
            @RequestParam("modelFile") MultipartFile modelFile,
            @RequestParam(name = "versionLabel", required = false) String versionLabel) {
        return modelAssetService.uploadPoseLandmarker(modelFile, versionLabel);
    }

    @DeleteMapping("/pose-landmarker/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePoseLandmarker(@PathVariable Long id) {
        modelAssetService.deletePoseLandmarker(id);
    }
}
