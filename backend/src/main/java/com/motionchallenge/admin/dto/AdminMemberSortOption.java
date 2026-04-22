package com.motionchallenge.admin.dto;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.JpaSort;

public enum AdminMemberSortOption {
    NEWEST {
        @Override
        public Sort toSort() {
            return Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        }
    },
    OLDEST {
        @Override
        public Sort toSort() {
            return Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"));
        }
    },
    NAME_ASC {
        @Override
        public Sort toSort() {
            return Sort.by(Sort.Order.asc("displayName"), Sort.Order.asc("id"));
        }
    },
    EMAIL_ASC {
        @Override
        public Sort toSort() {
            return Sort.by(Sort.Order.asc("email"), Sort.Order.asc("id"));
        }
    },
    PROVIDER_ASC {
        @Override
        public Sort toSort() {
            return JpaSort.unsafe(
                            Sort.Direction.ASC,
                            "case member.authProvider "
                                    + "when 'LOCAL' then 0 "
                                    + "when 'KAKAO' then 1 "
                                    + "when 'NAVER' then 2 "
                                    + "when 'GOOGLE' then 3 "
                                    + "else 4 end")
                    .and(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        }
    };

    public abstract Sort toSort();
}
