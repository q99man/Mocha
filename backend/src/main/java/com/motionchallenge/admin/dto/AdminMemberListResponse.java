package com.motionchallenge.admin.dto;

import java.util.List;

public record AdminMemberListResponse(
        List<AdminMemberSummaryResponse> items,
        long totalCount,
        int page,
        int size) {
}
